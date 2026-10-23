import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectFileWriter, type ProjectFileHandle } from '../lib/editor/project-file';

test('repeated saves commit in order and replace the entire contents', async () => {
  const writer = new ProjectFileWriter();
  let contents = 'old long project', active = 0, maximum = 0;
  const committed: string[] = [];
  const handle: ProjectFileHandle = {name:'test.corte15',getFile:async()=>new File([contents],'test.corte15'),
    requestPermission:async()=> 'granted',createWritable:async()=> {
      maximum=Math.max(maximum,++active);let pending='';
      return {write:async value=>{pending=value;await new Promise(resolve=>setTimeout(resolve,5));},
        close:async()=>{contents=pending;committed.push(pending);active--;},abort:async()=>{active--;}};
    }};
  await Promise.all([writer.write(handle,'first'),writer.write(handle,'last')]);
  assert.deepEqual(committed,['first','last']);assert.equal(contents,'last');assert.equal(maximum,1);
});
test('denied permission does not open a writer or modify the file', async () => {
  const writer=new ProjectFileWriter();let opened=false;
  const handle={name:'test.corte15',requestPermission:async()=> 'denied',createWritable:async()=>{opened=true;}} as unknown as ProjectFileHandle;
  await assert.rejects(writer.write(handle,'changed'),/permiso/);assert.equal(opened,false);
});
test('failed write aborts and does not block the next save', async () => {
  const writer=new ProjectFileWriter();let aborts=0,closes=0,fail=true;
  const handle={name:'test.corte15',createWritable:async()=>({write:async()=>{if(fail)throw Error('disk full');},close:async()=>{closes++;},abort:async()=>{aborts++;}})} as unknown as ProjectFileHandle;
  await assert.rejects(writer.write(handle,'first'),/disk full/);
  assert.equal(aborts,1);assert.equal(closes,0);fail=false;
  await writer.write(handle,'next');assert.equal(closes,1);
});

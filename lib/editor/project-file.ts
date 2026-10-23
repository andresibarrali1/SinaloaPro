export type ProjectFileHandle = {
  name: string;
  getFile(): Promise<File>;
  requestPermission?: (options: {mode: 'readwrite'}) => Promise<PermissionState>;
  createWritable(): Promise<{write(data: string): Promise<void>; close(): Promise<void>; abort(): Promise<void>}>;
};
export type ProjectPickerWindow = Window & {
  showOpenFilePicker?: (options: {multiple: boolean; types: {description: string; accept: Record<string,string[]>}[]}) => Promise<ProjectFileHandle[]>;
};

/** Serializes writes so repeated Ctrl+S cannot finish in the wrong order. */
export class ProjectFileWriter {
  private tail: Promise<void> = Promise.resolve();
  write(handle: ProjectFileHandle, contents: string): Promise<void> {
    // Ask while the save still belongs to the user's click/keystroke.
    const permission = handle.requestPermission?.({mode:'readwrite'}) ?? Promise.resolve('granted');
    // Attach rejection handling immediately, even if another write is pending.
    const allowed = permission.then(value => value === 'granted', () => false);
    const write = this.tail.catch(() => {}).then(async () => {
      if (!await allowed) throw new Error('No se concedió permiso para sobrescribir el proyecto. El archivo original no cambió.');
      const stream = await handle.createWritable();
      try { await stream.write(contents); await stream.close(); }
      catch (error) { await stream.abort().catch(() => {}); throw error; }
    });
    this.tail = write;
    return write;
  }
}

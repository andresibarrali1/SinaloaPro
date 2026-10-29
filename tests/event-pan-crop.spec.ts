// Pending browser execution: these assertions target the replacement event Pan/Crop window.
import { test, expect } from "@playwright/test";
import { newProject, newEvent } from "../lib/editor/project";
test("Pan/Crop: layout, inverse zoom, independent axes, keys and reopening", async ({
  page,
}) => {
  const project = newProject(),
    event = newEvent(project.tracks[0].id, "color");
  event.name = "Encuadre de prueba";
  project.events.push(event);
  await page.goto('/?bienvenida=no');
  await page.evaluate((p) => {
    localStorage.clear();
    localStorage.setItem("corte15-autosave-v1", JSON.stringify(p));
  }, project);
  await page.reload();
  const clip = page.locator(".timeline-event.video").first();
  await clip.hover();
  await clip.getByRole("button", { name: /Panoramización y recorte/ }).click();
  const dialog = page.locator(".ec-window");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".ec-handle")).toHaveCount(8);
  await expect(dialog.locator(".ec-orientation")).toBeVisible();
  await expect(dialog.getByLabel("Anchura", { exact: true })).toHaveValue(
    "1,920.0",
  );
  await dialog.getByLabel("Anchura", { exact: true }).fill("960");
  await dialog.getByLabel("Anchura", { exact: true }).press("Enter");
  await expect(dialog.getByLabel("Altura", { exact: true })).toHaveValue(
    "540.0",
  );
  await dialog
    .getByRole("button", { name: "Bloquear relación de aspecto", exact: true })
    .click();
  await dialog.getByLabel("Altura", { exact: true }).fill("810");
  await dialog.getByLabel("Altura", { exact: true }).press("Enter");
  await expect(dialog.getByLabel("Anchura", { exact: true })).toHaveValue(
    "960.0",
  );
  await dialog
    .getByRole("button", { name: "Añadir fotograma clave", exact: true })
    .click();
  const state = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("corte15-autosave-v1")!).events[0],
    );
  await expect
    .poll(async () => (await state()).keys[0]?.cropFrame?.height)
    .toBe(0.75);
  await page.screenshot({ path: "evidencias/pancrop-referencia-nueva.png" });
  await dialog
    .getByRole("button", { name: "Cerrar Panoramización/Recorte", exact: true })
    .click();
  await page.reload();
  await clip.hover();
  await clip.getByRole("button", { name: /Panoramización y recorte/ }).click();
  await expect(dialog.getByLabel("Anchura", { exact: true })).toHaveValue(
    "960.0",
  );
  await expect(dialog.getByLabel("Altura", { exact: true })).toHaveValue(
    "810.0",
  );
});

test("manipular máscara: mover interior, vértices y persistir", async ({page}) => {
 const project=newProject(), event=newEvent(project.tracks[0].id,"color");
 event.maskPath={points:[{x:.25,y:.25},{x:.65,y:.25},{x:.65,y:.65},{x:.25,y:.65}],feather:0,invert:false};
 project.events.push(event);
 await page.goto('/?bienvenida=no');
 await page.evaluate(p=>{localStorage.clear();localStorage.setItem('corte15-autosave-v1',JSON.stringify(p));},project);
 await page.reload();
 const clip=page.locator('.timeline-event.video').first();
 await clip.hover();await clip.getByRole('button',{name:/Panoramización y recorte/}).click();
 const dialog=page.locator('.ec-window');
 await dialog.getByRole('checkbox').check();
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('corte15-autosave-v1')!).events[0].maskPath.points);
 const body=dialog.locator('.ec-mask-body');
 const box=(await body.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 await page.mouse.move(box.x+box.width/2+30,box.y+box.height/2+20,{steps:8});await page.mouse.up();
 await expect.poll(async()=>(await state())[0].x).toBeGreaterThan(.25);
 const moved=await state();
 const pt=(await dialog.locator('.ec-mask-point').first().boundingBox())!;
 await page.mouse.move(pt.x+pt.width/2,pt.y+pt.height/2);await page.mouse.down();
 await page.mouse.move(pt.x+pt.width/2+20,pt.y+pt.height/2+10,{steps:6});await page.mouse.up();
 await expect.poll(async()=>(await state())[0].x).toBeGreaterThan(moved[0].x);
 const edited=await state();expect(edited[1]).toEqual(moved[1]);
 await dialog.getByRole('button',{name:'Cerrar Panoramización/Recorte',exact:true}).click();
 await page.reload();expect(await state()).toEqual(edited);
});

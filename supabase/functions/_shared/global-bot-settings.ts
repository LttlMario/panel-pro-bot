export async function readGlobalModules(db: any) {
  const { data, error } = await db.from('discovery_bot_global_settings').select('modules').eq('id', 'global').maybeSingle();
  if (error) throw error;
  return data?.modules && typeof data.modules === 'object' ? data.modules : {};
}
export function mergeModuleDefinitions(base: Record<string, any>, overrides: Record<string, any>) {
  return Object.fromEntries(Object.entries(base).map(([key, definition]) => {
    const override = overrides?.[key] && typeof overrides[key] === 'object' ? overrides[key] : {};
    const buttons = Array.isArray(override.buttons) ? override.buttons.map((button: any, index: number) => ({ ...definition.buttons[index], label: button.label ?? definition.buttons[index]?.label, style: button.style ?? definition.buttons[index]?.style })).filter((button: any) => button?.id) : definition.buttons;
    return [key, { ...definition, title: override.title ?? definition.title, description: override.description ?? definition.description, color: override.color ?? definition.color, buttons }];
  }));
}
export function sanitizeModuleOverrides(base: Record<string, any>, input: any) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configurația globală este invalidă.');
  const result: Record<string, any> = {};
  for (const [key, definition] of Object.entries(base)) {
    const value = input[key]; if (!value || typeof value !== 'object') continue;
    const next: any = {};
    if (value.title !== undefined) { const title = String(value.title).trim(); if (!title || title.length > 256) throw new Error(`Titlul modulului ${key} este invalid.`); next.title = title; }
    if (value.description !== undefined) { const description = String(value.description).trim(); if (description.length > 4096) throw new Error(`Descrierea modulului ${key} este prea lungă.`); next.description = description; }
    if (value.color !== undefined) { const color = Number(value.color); if (!Number.isInteger(color) || color < 0 || color > 0xffffff) throw new Error(`Culoarea modulului ${key} este invalidă.`); next.color = color; }
    if (Array.isArray(value.buttons)) { if (value.buttons.length > definition.buttons.length) throw new Error(`Modulul ${key} are prea multe butoane.`); next.buttons = value.buttons.map((button: any, index: number) => ({ id: definition.buttons[index]?.id, label: String(button?.label ?? definition.buttons[index]?.label ?? '').trim().slice(0, 80), style: Number(button?.style ?? definition.buttons[index]?.style ?? 2) })).filter((button: any) => button.id && button.label && [1, 2, 3, 4].includes(button.style)); }
    result[key] = next;
  }
  return result;
}

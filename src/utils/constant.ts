export const DATASOURCE_TYPE = {
  JSON: 'json',
  RAINBOW: 'rainbow',
};

export const CELL = {
  MODULE: 'module',
  ID: 'id',
  ZH: 'zh',
  ZH_PLURAL: 'zh_plural',
  EN: 'en',
  EN_PLURAL: 'en_plural',
  ORIGIN: 'origin',
  NOTE: 'note',
} as const;

export const DEFAULT_HEADER = [
  CELL.MODULE,
  CELL.ID,
  CELL.ZH,
  CELL.ZH_PLURAL,
  CELL.EN,
  CELL.EN_PLURAL,
] as const;

export const I18N_STORE_KEYS = [
  CELL.MODULE,
  CELL.ID,
  CELL.ZH,
  CELL.EN,
  CELL.EN_PLURAL,
  CELL.ORIGIN,
  CELL.NOTE,
  'isRedundant',
] as const;

export default {
  CELL,
  DEFAULT_HEADER,
  I18N_STORE_KEYS,
};

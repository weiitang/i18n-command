export interface Record {
  module: string;
  id: string;
  zh: string;
  en?: string;
  en_plural?: string;
  isRedundant?: boolean;
  origin?: string;
  note?: string;
}

export type RecordList = Record[];

export type RecordMap = {
  [id: string]: Record;
};

export type RecordListMap = {
  [keys: string]: RecordList;
};

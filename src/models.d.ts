import { LogInstance } from 'larvitutils';
import { Db } from 'larvitdb-pg';

export type GetOrderFields = {
	[key: string]: GetOrderFieldsFields;
};

export type GetOrderFieldsFields = {
	[key: string]: string[];
};

export type OrderConstructorOptions = {
	log: LogInstance;
	db: Db;
};

export type OrderDataFields = {
	[key: string]: string[];
};

export type OrderDataRow = {
	[key: string]: string[];
};

export type OrderData = {
	uuid?: string[];
	fields?: OrderDataFields;
	rows?: OrderDataRow[];
};

export type OrderDataByUuid = {
	[type: string]: OrderData;
};

export type GetOptions = {
	uuids?: string[];
	matchAllFields?: GetOptionsMatchAllFields;
	returnFields?: string[] | '*';
	returnRowFields?: string[] | '*';
	limit?: number;
	offset?: number;
};

export type GetOptionsMatchAllFields = {
	[key: string]: string;
};

export type GetOrderRowsFields = {
	[key: string]: GetOrderRowsFieldsRowFields;
};

export type GetOrderRowsFieldsRowFields = {
	[key: string]: string[];
};

export type RowUuidsByOrderUuids = {
	[key: string]: string[];
};

export type WriteableOrderOptions = {
	uuid: string[];
	fields: OrderDataFields;
	rows: OrderDataRow[];
};

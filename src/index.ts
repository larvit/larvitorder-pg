import { LogInstance } from 'larvitutils';
import { Db } from 'larvitdb-pg';
import uuid from 'uuid/v4';
import { DbMigration } from 'larvitdbmigration-pg';

type GetOrderFields = {
	[key: string]: GetOrderFieldsFields;
};

type GetOrderFieldsFields = {
	[key: string]: string[];
};

type OrderConstructorOptions = {
	log: LogInstance;
	db: Db;
};

type OrderDataFields = {
	[key: string]: string | string[];
};

type OrderDataRow = {
	[key: string]: string | number | string[] | number[];
};

type OrderData = {
	uuid?: string;
	fields?: OrderDataFields;
	rows?: OrderDataRow[];
};

type OrderDataByUuid = {
	[type: string]: OrderData;
};

type GetOptions = {
	uuids?: string[];
	matchAllFields?: GetOptionsMatchAllFields;
	returnFields?: string[] | '*';
	returnRowFields?: string[] | '*';
	limit?: number;
	offset?: number;
};

type GetOptionsMatchAllFields = {
	[key: string]: string;
};

type GetOrderRowsFields = {
	[key: string]: GetOrderRowsFieldsRowFields;
};

type GetOrderRowsFieldsRowFields = {
	[key: string]: string[];
};

type RowUuidsByOrderUuids = {
	[key: string]: string[];
};

type WriteableOrderOptions = {
	uuid: string;
	fields: OrderDataFields;
	rows: OrderDataRow[];
};

const topLogPrefix = 'larvitorder-pg: src/index.ts: ';

class Order {
	private db: Db;
	private log: LogInstance;
	private migrated = false;

	constructor(options: OrderConstructorOptions) {
		this.db = options.db;
		this.log = options.log;
	}

	public async get(options?: GetOptions): Promise<WriteableOrderOptions[]> {
		const logPrefix = topLogPrefix + 'get() - ';
		const { log, db } = this;
		const ordersByUuid: OrderDataByUuid = {};
		await this.migrate();

		options = options || {};

		// Get all order uuids to fetch data from
		async function getOrderUuids(uuidOptions: GetOptions): Promise<string[]> {
			let sql = 'SELECT uuid FROM order_orders WHERE 1 = 1';
			const dbFields = [];

			if (Array.isArray(uuidOptions.uuids)) {
				log.debug(logPrefix + 'Selecting on uuids: ' + JSON.stringify(uuidOptions.uuids));
				sql += ' AND uuid = ANY($1)';
				dbFields.push(uuidOptions.uuids);
			}

			const { rows: orderUuidRows } = await db.query(sql, dbFields);

			const result = [];
			for (let i = 0; orderUuidRows.length !== i; i++) {
				result.push(orderUuidRows[i].uuid);
			}

			return result;
		}

		// Get order fields
		async function getOrderFields(uuids: string[], fields: string[] | '*'): Promise<GetOrderFields> {
			const result: GetOrderFields = {};
			let sql = 'SELECT * FROM order_orders_fields WHERE "orderUuid" = ANY($1)';
			const dbFields = [uuids];

			if (fields !== '*') {
				sql += ' AND name = ANY($2)';
				dbFields.push(fields);
			}

			const { rows } = await db.query(sql, dbFields);
			for (let i = 0; rows.length !== i; i++) {
				const row = rows[i];
				if (result[row.orderUuid] === undefined) {
					result[row.orderUuid] = {};
				}
				if (result[row.orderUuid][row.name] === undefined) {
					result[row.orderUuid][row.name] = [];
				}
				result[row.orderUuid][row.name].push(row.value);
			}

			return result;
		}

		// Get order rows uuids
		async function getOrderRowsUuids(orderUuids2: string[]): Promise<RowUuidsByOrderUuids> {
			const result: RowUuidsByOrderUuids = {};
			const { rows } = await db.query('SELECT * FROM order_orders_rows WHERE "orderUuid" = ANY($1)', [orderUuids2]);
			for (let i = 0; rows.length !== i; i++) {
				const row = rows[i];

				if (result[row.orderUuid] === undefined) {
					result[row.orderUuid] = [];
				}

				result[row.orderUuid].push(row.uuid);
			}

			return result;
		}

		// Get order rows fields
		async function getOrderRowsFields(rowUuids: string[], fields: string[] | '*'): Promise<GetOrderRowsFields> {
			const result: GetOrderRowsFields = {};
			const dbFields = [rowUuids];
			let sql = /*sql*/`
				SELECT *
				FROM order_orders_rows_fields
				WHERE "rowUuid" = ANY($1)
			`;

			if (fields !== '*') {
				sql += /*sql*/` AND rf.name = ANY($2)`;
				dbFields.push(fields);
			}

			const { rows } = await db.query(sql, dbFields);

			for (let i = 0; rows.length !== i; i++) {
				const row = rows[i];

				if (result[row.uuid] === undefined) {
					result[row.uuid] = {};
				}

				if (result[row.uuid][row.name] === undefined) {
					result[row.uuid][row.name] = [];
				}

				result[row.uuid][row.name].push(row.value);
			}

			return result;
		}

		const orderUuids = await getOrderUuids(options || {});

		// Construct ordersByUuids object so we can populate the different result sets
		for (let i = 0; orderUuids.length !== i; i++) {
			ordersByUuid[orderUuids[i]] = {
				uuid: orderUuids[i],
			};
		}

		// Set fields if they exists
		if (options.returnFields) {
			const orderFields = await getOrderFields(orderUuids, options.returnFields);
			for (const [ key, value ] of Object.entries(orderFields)) {
				ordersByUuid[key].fields = value;
			}
		}

		// Get all existing order rows
		const orderRowUuids = await getOrderRowsUuids(orderUuids);

		// Construct all rows on the orders in the result object
		const orderRowUuidsPlain = [];
		for (const [ orderUuid, rowUuids ] of Object.entries(orderRowUuids)) {
			ordersByUuid[orderUuid].rows = [];
			for (let i = 0; rowUuids.length !== i; i++) {
				orderRowUuidsPlain.push(rowUuids[i]);
				// Typescript is got damn NOT done yet...
				// @ts-ignore
				ordersByUuid[orderUuid].rows.push({
					uuid: rowUuids[i],
				});
			}
		}

		// Set row fields if they exists
		if (options.returnRowFields) {
			const result = await getOrderRowsFields(orderRowUuidsPlain, options.returnRowFields);
			// tslint:disable-next-line
			console.log('result', result);
		}

		// tslint:disable-next-line
		console.log('ordersByUuid', ordersByUuid);

		// Construct the return array with complete orders
		const ordersResult: WriteableOrderOptions[] = [];
		Object.values(ordersByUuid).forEach(orderData => {
			const orderEntry = {
				uuid: orderData.uuid || 'issue',
				fields: orderData.fields || {},
				rows: orderData.rows || [],
			};
			ordersResult.push(orderEntry);
		});

		return ordersResult;
	}

	public async migrate(): Promise<void> {
		const logPrefix = topLogPrefix + 'migrate() - ';
		const { db, log } = this;

		log.silly(logPrefix + 'Initializing db migration');

		if (this.migrated === true) {
			log.silly(logPrefix + 'Already migrated, just return');
			return;
		}

		const dbMigration = new DbMigration({ log, dbDriver: db, tableName: 'larvitorder_db_version' });

		await dbMigration.run();

		log.verbose(logPrefix + 'Database migrated');

		this.migrated = true;
	}

	public async save(orderData: OrderData): Promise<WriteableOrderOptions> {
		const logPrefix = topLogPrefix + 'save() - ';
		const { log, db } = this;
		await this.migrate();

		log.debug(logPrefix + 'Saving order');

		if (!orderData.uuid) {
			log.verbose(logPrefix + 'No uuid supplied, creating a brand new (world) order');

			const newOrderData = {
				uuid: uuid(),
				fields: orderData.fields || {},
				rows: orderData.rows || [],
			};

			return this.create(newOrderData);
		}

		// Check if this order exists in the database at all
		const result = await db.query('SELECT * FROM order_orders WHERE uuid = $1', [orderData.uuid]);
		if (result.rows.length === 0) {
			log.verbose(logPrefix + 'Uuid supplied, but no order exists in database, creating a brand new (world) order');

			const newOrderData = {
				uuid: orderData.uuid,
				fields: orderData.fields || {},
				rows: orderData.rows || [],
			};

			return this.create(newOrderData);
		}

		// Lock database

		// Fetch the current order

		//

		// Unlock database

		// todo: Make sure this is correct
		// @ts-ignore
		return orderData;
	}

	private async create(orderData: WriteableOrderOptions): Promise<WriteableOrderOptions> {
		const logPrefix = topLogPrefix + 'create() - ';
		const { log, db } = this;

		log.debug(logPrefix + 'Creating new order');

		await this.migrate();

		await db.query('INSERT INTO order_orders (uuid) VALUES($1);', [orderData.uuid]);

		let fieldsSql = 'INSERT INTO order_orders_fields ("orderUuid", name, value) VALUES';
		const fieldsDbFields = [];
		let counter = 1;
		for (const [ key, value ] of Object.entries(orderData.fields)) {
			fieldsSql += '($' + String(counter) + ',';
			counter ++;
			fieldsDbFields.push(orderData.uuid);

			fieldsSql += '$' + String(counter) + ',';
			counter ++;
			fieldsDbFields.push(key);

			fieldsSql += '$' + String(counter) + '),';
			counter ++;
			fieldsDbFields.push(value);
		}
		if (fieldsDbFields.length !== 0) {
			fieldsSql = fieldsSql.substring(0, fieldsSql.length - 1 ) + ';';
			await db.query(fieldsSql, fieldsDbFields);
		}

		for (let i = 0; orderData.rows.length !== i; i++) {
			const row = orderData.rows[i];
			if (!row.uuid) {
				row.uuid = uuid();
			}
			await db.query('INSERT INTO order_orders_rows (uuid, "orderUuid") VALUES($1,$2);', [row.uuid, orderData.uuid]);
			let rowFieldsSql = 'INSERT INTO order_orders_rows_fields ("rowUuid", name, value) VALUES';
			const rowFieldsDbFields = [];
			let subCounter = 1;
			for (const [ key, value ] of Object.entries(row)) {
				if (key === 'uuid') {
					continue;
				}
				rowFieldsSql += '($' + String(subCounter) + ',';
				subCounter ++;
				rowFieldsDbFields.push(row.uuid);

				rowFieldsSql += '$' + String(subCounter) + ',';
				subCounter ++;
				rowFieldsDbFields.push(key);

				rowFieldsSql += '$' + String(subCounter) + '),';
				subCounter ++;
				rowFieldsDbFields.push(value);
			}
			if (rowFieldsDbFields.length !== 0) {
				rowFieldsSql = rowFieldsSql.substring(0, rowFieldsSql.length - 1);
				await db.query(rowFieldsSql, rowFieldsDbFields);
			}
		}

		const newOrdersFromDb = await this.get({ uuids: [orderData.uuid], returnFields: '*', returnRowFields: '*' });

		return newOrdersFromDb[0];
	}
}

export { Order };

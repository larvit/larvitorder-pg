import { LogInstance } from 'larvitutils';
import { Db } from 'larvitdb-pg';
import uuid from 'uuid/v4';
import { DbMigration } from 'larvitdbmigration-pg';
import {
	OrderConstructorOptions,
	GetOptions,
	WriteableOrderOptions,
	OrderDataByUuid,
	GetOrderFields,
	RowUuidsByOrderUuids,
	GetOrderRowsFields,
	OrderData,
} from './models';

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

				if (result[row.rowUuid] === undefined) {
					result[row.rowUuid] = {
						uuid: [row.rowUuid],
					};
				}

				if (result[row.rowUuid][row.name] === undefined) {
					result[row.rowUuid][row.name] = [];
				}

				result[row.rowUuid][row.name].push(row.value);
			}

			return result;
		}

		const orderUuids = await getOrderUuids(options || {});

		// Construct ordersByUuids object so we can populate the different result sets
		for (let i = 0; orderUuids.length !== i; i++) {
			ordersByUuid[orderUuids[i]] = {
				uuid: [orderUuids[i]],
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
					uuid: [rowUuids[i]],
				});
			}
		}

		// Set row fields if they exists
		if (options.returnRowFields) {
			const orderRowFields = await getOrderRowsFields(orderRowUuidsPlain, options.returnRowFields);

			for (const order of Object.values(ordersByUuid)) {
				if (!Array.isArray(order.rows)) {
					order.rows = [];
				}
				for (let i = 0; order.rows.length !== i; i++) {
					const row = order.rows[i];

					if (orderRowFields[String(row.uuid)]) {
						order.rows[i] = Object.assign(row, orderRowFields[String(row.uuid)]);
					}
				}
			}
		}

		// Construct the return array with complete orders
		const ordersResult: WriteableOrderOptions[] = [];
		Object.values(ordersByUuid).forEach(orderData => {
			const orderEntry = {
				uuid: orderData.uuid ? orderData.uuid : ['issue'],
				fields: orderData.fields || {},
				rows: orderData.rows || [],
			} as WriteableOrderOptions;
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

	public async rm(uuids: string[]): Promise<void> {
		const logPrefix = topLogPrefix + 'rm() - ';
		const { log, db } = this;
		await this.migrate();

		log.debug(logPrefix + 'Removing orders');

		if (!Array.isArray(uuids) || uuids.length === 0) {
			const err = new Error('Uuids needs to be an array and/or have at least one member.');
			log.warn(logPrefix + err.message);
			throw err;
		}

		let sql = 'DELETE FROM order_orders WHERE 1 = 1';
		const dbFields = [];

		log.debug(logPrefix + 'Deleting order with uuids: ' + JSON.stringify(uuids));
		sql += ' AND uuid = ANY($1)';
		dbFields.push(uuids);

		await db.query(sql, dbFields);
	}

	public async save(orderData: OrderData): Promise<WriteableOrderOptions> {
		const logPrefix = topLogPrefix + 'save() - ';
		const { log, db } = this;
		await this.migrate();

		log.debug(logPrefix + 'Saving order');

		if (!orderData.uuid) {
			log.verbose(logPrefix + 'No uuid supplied, creating a brand new (world) order');

			const newOrderData = {
				uuid: [uuid()],
				fields: orderData.fields || {},
				rows: orderData.rows || [],
			};

			return this.create(newOrderData);
		}

		// Check if this order exists in the database at all
		const result = await db.query('SELECT * FROM order_orders WHERE uuid = $1', [String(orderData.uuid)]);
		if (result.rows.length === 0) {
			log.verbose(logPrefix + 'Uuid supplied, but no order exists in database, creating a brand new (world) order');

			const newOrderData = {
				uuid: orderData.uuid,
				fields: orderData.fields || {},
				rows: orderData.rows || [],
			};

			return this.create(newOrderData);
		} else {
			log.info(logPrefix + 'Order exists, modify! IMPORTANT!!! This code is inefficient as ****, please fix!');
			// UGLY CODE! Please fix me!

			await this.rm(orderData.uuid);

			const newOrderData = {
				uuid: orderData.uuid,
				fields: orderData.fields || {},
				rows: orderData.rows || [],
			};

			return this.create(newOrderData);

			// How it should be done:

			// Lock database

			// Fetch the current order

			// Modify, save

			// Unlock database

			// return result;
		}
	}

	private async create(orderData: WriteableOrderOptions): Promise<WriteableOrderOptions> {
		const logPrefix = topLogPrefix + 'create() - ';
		const { log, db } = this;

		log.debug(logPrefix + 'Creating new order');

		await this.migrate();

		await db.query('INSERT INTO order_orders (uuid) VALUES($1);', [String(orderData.uuid)]);

		let fieldsSql = 'INSERT INTO order_orders_fields ("orderUuid", name, value) VALUES';
		const fieldsDbFields = [];
		let counter = 1;
		for (const [ key, values ] of Object.entries(orderData.fields)) {
			for (let i = 0; values.length !== i; i++) {
				const value = values[i];
				fieldsSql += '($' + String(counter) + ',';
				counter ++;
				fieldsDbFields.push(String(orderData.uuid));

				fieldsSql += '$' + String(counter) + ',';
				counter ++;
				fieldsDbFields.push(key);

				fieldsSql += '$' + String(counter) + '),';
				counter ++;
				fieldsDbFields.push(value);
			}
		}
		if (fieldsDbFields.length !== 0) {
			fieldsSql = fieldsSql.substring(0, fieldsSql.length - 1 ) + ';';
			await db.query(fieldsSql, fieldsDbFields);
		}

		for (let i = 0; orderData.rows.length !== i; i++) {
			const row = orderData.rows[i];
			if (!row.uuid) {
				row.uuid = [uuid()];
			}
			await db.query('INSERT INTO order_orders_rows (uuid, "orderUuid") VALUES($1,$2);', [String(row.uuid), String(orderData.uuid)]);
			let rowFieldsSql = 'INSERT INTO order_orders_rows_fields ("rowUuid", name, value) VALUES';
			const rowFieldsDbFields = [];
			let subCounter = 1;
			for (const [ key, values ] of Object.entries(row)) {
				if (key === 'uuid') {
					continue;
				}
				for (let i2 = 0; values.length !== i2; i2++) {
					const value = values[i2];
					rowFieldsSql += '($' + String(subCounter) + ',';
					subCounter ++;
					rowFieldsDbFields.push(String(row.uuid));

					rowFieldsSql += '$' + String(subCounter) + ',';
					subCounter ++;
					rowFieldsDbFields.push(key);

					rowFieldsSql += '$' + String(subCounter) + '),';
					subCounter ++;
					rowFieldsDbFields.push(value);
				}
			}
			if (rowFieldsDbFields.length !== 0) {
				rowFieldsSql = rowFieldsSql.substring(0, rowFieldsSql.length - 1);
				await db.query(rowFieldsSql, rowFieldsDbFields);
			}
		}

		const newOrdersFromDb = await this.get({ uuids: orderData.uuid, returnFields: '*', returnRowFields: '*' });

		return newOrdersFromDb[0];
	}
}

export { Order };

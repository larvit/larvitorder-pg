import test from 'tape';
import dotenv from 'dotenv';
import { Log } from 'larvitutils';
import { Db } from 'larvitdb-pg';
import { Order } from '../src/index';

dotenv.config();

const log = new Log();
let orderLib: Order;
let db: Db;

test('Setup database connection and initialize orderLib', async t => {
	const dbConf = {
		log,
		host: process.env.DB_HOST || '127.0.0.1',
		port: process.env.DB_PORT === undefined ? undefined : Number(process.env.DB_PORT),
		user: process.env.DB_USER || 'postgres',
		password: process.env.DB_PASSWORD,
		database: process.env.DB_DATABASE || 'test',
		connectionString: process.env.DB_CONNECTIONSTRING,
	};

	db = new Db(dbConf);
	orderLib = new Order({ db, log });

	const res = await db.query('SELECT NOW()');

	t.equal(res.rows[0].now instanceof Date, true);

	t.end();
});

if (process.env.CLEAR_DB === 'true') {
	test('Cleanup', async t => {
		await db.resetSchema('public');
		t.end();
	});
}

test('Create a new order without uuid', async t => {
	const order = {
		fields: {
			firstname: 'Günter',
			lastname: ['Edelweiss', 'Schloffs'],
		},
		rows: [
			{
				price: 399,
				name: 'Screw',
			},
			{
				price: 34,
				name: 'teh_foo',
				/* tags: ['foo', 'bar'], todo: fix me!!!!! */
			},
		],
	};

	const result = await orderLib.save(order);

	t.equal(typeof result.uuid, 'string', 'The uuid should now be a string');

	t.end();
});

test('Create a new order with uuid', async t => {
	const order = {
		uuid: '03250c8c-bf88-44d8-a326-b6987d3990d1',
		fields: {
			firstname: 'Günter',
			lastname: ['Edelweiss', 'Schloffs'],
		},
		rows: [
			{
				uuid: '0bff939c-c489-44ce-815f-2a2506efeff3',
				price: 399,
				name: 'Screw',
			},
			{
				uuid: '7e816ee1-0a37-4b77-b415-70d754703696',
				price: 34,
				name: 'teh_foo',
				/* tags: ['foo', 'bar'], todo: fix me!!!!! */
			},
		],
	};

	const result = await orderLib.save(order);

	t.equal(JSON.stringify(order), JSON.stringify(result), 'The order object to be saved should be identical to the actual saved result');
	t.end();
});

test('Remove an order', async t => {
	const orderUuid = '03250c8c-bf88-44d8-a326-b6987d3990d1';
	await orderLib.rm([orderUuid]);

	const { rows } = await db.query('SELECT * FROM order_orders WHERE uuid = $1', [orderUuid]);

	t.equal(rows.length, 0, 'There should be no rows in the database.');
	t.end();
});

test('Remove an order without sending in any UUIDs', async t => {
	let error;

	try {
		await orderLib.rm([]);
	} catch (err) {
		error = err;
	}

	t.equal(error instanceof Error, true, 'Should get an error when sending a empty array.');
	t.end();
});

test('Cleanup', async t => {
	db.end();
	t.end();
});

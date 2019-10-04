import test from 'tape';
import dotenv from 'dotenv';
import { Log } from 'larvitutils';
import { Db } from 'larvitdb-pg';
import { Order } from '../src/index';
import { OrderData } from '../src/models';

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
	const order: OrderData = {
		fields: {
			firstname: ['Günter'],
			lastname: ['Edelweiss', 'Schloffs'],
		},
		rows: [
			{
				price: ['399'],
				name: ['Screw'],
			},
			{
				price: ['34'],
				name: ['teh_foo'],
				tags: ['foo', 'bar'],
			},
		],
	};

	const result = await orderLib.save(order);

	t.equal(typeof result.uuid[0], 'string', 'The uuid should now be an array with one string');
	t.equal(String(Object.keys(result.fields)), 'firstname,lastname', 'Fields should be firstname and lastname');

	t.end();
});

test('Create a new order with uuid', async t => {
	t.plan(10);

	const order: OrderData = {
		uuid: ['03250c8c-bf88-44d8-a326-b6987d3990d1'],
		fields: {
			firstname: ['Günter'],
			lastname: ['Edelweiss', 'Schloffs'],
		},
		rows: [
			{
				uuid: ['0bff939c-c489-44ce-815f-2a2506efeff3'],
				price: ['399'],
				name: ['Screw'],
			},
			{
				uuid: ['7e816ee1-0a37-4b77-b415-70d754703696'],
				price: ['34'],
				name: ['teh_foo'],
				tags: ['foo', 'bar'],
			},
		],
	};

	const result = await orderLib.save(order);

	t.equal(String(result.uuid), String(order.uuid), 'The uuid on the input and output order should match');
	t.equal(Object.keys(result.fields).length, 2, 'Exactly 2 fields should be saved');
	t.equal(result.fields.firstname[0], 'Günter', 'The firstname should be an array of one Günter');
	t.equal(result.fields.lastname.includes('Schloffs'), true, 'The lastname should contain an entry of "Schloffs"');
	t.equal(result.rows.length, 2, 'Two rows should be saved');

	for (let i = 0; result.rows.length !== i; i++) {
		const row = result.rows[i];
		if (row.uuid[0] === '0bff939c-c489-44ce-815f-2a2506efeff3') {
			t.equal(String(row.price), '399', 'Row price should be 399 on a specific row');
			t.equal(String(row.name), 'Screw', 'The name on a specific row should be "Screw"');
		} else if (row.uuid[0] === '7e816ee1-0a37-4b77-b415-70d754703696') {
			t.equal(Object.keys(row).length, 4, 'On another specific row there should be 4 keys');
			t.equal(row.tags.length, 2, 'Two tags should exist on a specific row');
			t.equal(row.tags.includes('foo'), true, 'One of them should be foo');
		} else {
			throw new Error('Unexpected row');
		}
	}

	t.end();
});

test('Remove an order', async t => {
	const orderUuid = '03250c8c-bf88-44d8-a326-b6987d3990d1';
	await orderLib.rm([orderUuid]);

	const { rows } = await db.query('SELECT * FROM order_orders WHERE uuid = $1', [orderUuid]);

	t.equal(rows.length, 0, 'There should be no rows in the database.');
	t.end();
});

test('Remove an order and not sending an array', async t => {
	let error;

	try {
		// @ts-ignore
		await orderLib.rm('lasse');
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

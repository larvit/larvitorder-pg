# Larvit order library running on PostgreSQL

Generic order module for nodejs.

order data structure:

```json
{
	"uuid": ["string"],
	"fields": {
		"field1": [
			"value1",
			"value2"
		],
		"field2": [
			"value3"
		]
	},
	"rows": [
		{
			"uuid": ["string"],
			"field1": ["394"],
			"field2": ["nisse", "20"]
		}
	]
}
```

## Installation

`npm i larvitorder-pg`

## Usage

### Initialize and requirements

First you need to set up a db connection. Larvitdb-pg is used here, but any compatible library will suffice.

```javascript
import { Db } from 'larvitdb-pg';
import { Order } from 'larvitorder-pg';

const db = new Db(...); // Se documentation on https://github.com/larvit/larvitdb-pg
const order = new Order({ db });
```

### Save an new order

Both create and update an existing order with the same call.

To create a new order, supply a non existing uuid or omit it completley, then a new will be generated.

```javascript
const order = {
	uuid: ['03250c8c-bf88-44d8-a326-b6987d3990d1'],
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

order.save(order).then(result => {
	console.log('order saved with uuid: ' + result.uuid);
}).catch(err => {
	throw err;
});
```

### Remove orders from database

```javascript
order.rm(['03250c8c-bf88-44d8-a326-b6987d3990d1']).then(() => {
	console.log('Orders are gone');
}).catch(err => {
	throw err;
});
```

### Load order from database

```javascript
order.get({
	uuids: ['03250c8c-bf88-44d8-a326-b6987d3990d1'], // Only return orders with these uuids
	matchAllFields: {firstname: 'Abraham', lastname: 'Lincoln'}, // Only return orders that have both the fields firstname and lastname that matches
	matchAllRowFields: {productName: 'A4 paper'}, // Only return orders that have rows matching both the row fieldname "productName" and the value "A4 paper"
	returnFields: ['firstname', 'lastname', 'status'], // Only return the order fields listed. IMPORTANT! Will return no order fields if not supplied! Because performance.
	returnRowFields: ['productName', 'price'], // Only return the order row fields listed. IMPORTANT! Will return no order row fields if not supplied! Because performance.
	limit: 100,
	offset: 100,
}).then(orders => {
	array of order objects
}).catch(err => {
	throw err;
});
```

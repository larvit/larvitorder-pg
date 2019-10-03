CREATE TABLE public.order_orders
(
	uuid uuid NOT NULL,
	created timestamp without time zone NOT NULL DEFAULT NOW(),
	CONSTRAINT order_orders_pkey PRIMARY KEY (uuid)
);

CREATE TABLE public.order_orders_fields
(
	"orderUuid" uuid NOT NULL,
	name character varying(256) COLLATE pg_catalog."default" NOT NULL,
	value character varying(65536) COLLATE pg_catalog."default" NOT NULL,
	CONSTRAINT "order_orders_fields_orderUuid_fkey" FOREIGN KEY ("orderUuid")
		REFERENCES public.order_orders (uuid) MATCH SIMPLE
		ON UPDATE NO ACTION
		ON DELETE NO ACTION
		NOT VALID
);

CREATE INDEX ON order_orders_fields ("orderUuid");
CREATE INDEX ON order_orders_fields ("orderUuid", name);

CREATE TABLE public.order_orders_rows
(
	uuid uuid NOT NULL,
	"orderUuid" uuid NOT NULL,
	CONSTRAINT order_orders_rows_pkey PRIMARY KEY (uuid),
	CONSTRAINT "order_orders_rows_orderUuid_fkey" FOREIGN KEY ("orderUuid")
		REFERENCES public.order_orders (uuid) MATCH SIMPLE
		ON UPDATE NO ACTION
		ON DELETE NO ACTION
		NOT VALID
);

CREATE TABLE public.order_orders_rows_fields
(
	"rowUuid" uuid NOT NULL,
	name character varying(256) COLLATE pg_catalog."default" NOT NULL,
	value character varying(65536) COLLATE pg_catalog."default" NOT NULL,
	CONSTRAINT "order_orders_rows_fields_rowUuid_fkey" FOREIGN KEY ("rowUuid")
		REFERENCES public.order_orders_rows (uuid) MATCH SIMPLE
		ON UPDATE NO ACTION
		ON DELETE NO ACTION
		NOT VALID
);

CREATE INDEX ON order_orders_rows_fields ("rowUuid");
CREATE INDEX ON order_orders_rows_fields ("rowUuid", name);

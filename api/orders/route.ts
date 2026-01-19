import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { buildOrderEmails } from '@/lib/orderEmail';

interface OrderPayload {
	customer: {
		firstName: string;
		lastName: string;
		country: string;
		email: string;
		phone: string;
		address: string;
		addressLine2: string;
		city: string;
		province: string;
		zipCode: string;
		orderNotes: string;
	};
	shipToDifferentAddress: boolean;
	shippingAddress?: {
		address: string;
		addressLine2: string;
		city: string;
		province: string;
		zipCode: string;
	};
	shippingMethod: 'regular' | 'express';
	subtotal: number;
	shippingCost: number;
	total: number;
	cartItems: Array<{
		id: number;
		name: string;
		price: number;
		quantity: number;
		image: string;
		description: string;
	}>;
}

async function readOrders(filePath: string) {
	try {
		const contents = await fs.readFile(filePath, 'utf8');
		return JSON.parse(contents) as Array<Record<string, unknown>>;
	} catch (error) {
		const nodeError = error as NodeJS.ErrnoException;
		if (nodeError.code === 'ENOENT') {
			return [];
		}
		throw error;
	}
}

export async function POST(request: Request) {
	try {
		const payload = (await request.json()) as OrderPayload;
		const ordersDir = path.join(process.cwd(), 'data');
		const ordersFile = path.join(ordersDir, 'orders.json');

		await fs.mkdir(ordersDir, { recursive: true });
		const existingOrders = await readOrders(ordersFile);

		const timestamp = Date.now();
		const orderNumber = `${timestamp}`.slice(-6);
		const createdAt = new Date().toISOString();
		const orderRecord = {
			id: `order_${timestamp}`,
			orderNumber,
			createdAt,
			...payload,
		};

		const emailData = buildOrderEmails({
			...payload,
			orderNumber,
			createdAt,
		});

		existingOrders.push({
			...orderRecord,
			emailPreview: {
				subject: emailData.customer.subject,
				text: emailData.customer.text,
			},
			adminEmailPreview: {
				subject: emailData.admin.subject,
				text: emailData.admin.text,
			},
		});
		await fs.writeFile(ordersFile, JSON.stringify(existingOrders, null, 2), 'utf8');

		return NextResponse.json({ ok: true, orderId: orderRecord.id });
	} catch (error) {
		console.error('Failed to store order', error);
		return NextResponse.json({ ok: false, error: 'Failed to store order' }, { status: 500 });
	}
}

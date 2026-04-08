#!/usr/bin/env node

/**
 * Email Migration Script: mail.puretide.ca → Zoho Mail
 * For orders@puretide.ca account
 *
 * This script migrates emails from your old mail server to Zoho.
 * It uses IMAP to connect to both servers and copies emails.
 */

import Imap from 'imap';
import { simpleParser } from 'mailparser';

// OLD SERVER (source)
const OLD_SERVER = {
	user: 'orders@puretide.ca',
	password: 'AvocadoPep2026',
	host: 'mail.puretide.ca',
	port: 993,
	tls: true,
	tlsOptions: { rejectUnauthorized: false },
};

// NEW ZOHO SERVER (destination)
const ZOHO_IMAP = {
	user: 'orders@puretide.ca',
	password: 'Ah7dh6h2fknP',
	host: 'imap.zohocloud.ca',
	port: 993,
	tls: true,
};

// Configuration
const DRY_RUN = false; // Set to false to actually migrate
const BATCH_SIZE = 10; // Number of emails to migrate at once
const MAILBOX = 'INBOX'; // Change to migrate other folders

/**
 * Connect to IMAP server
 */
function connectImap(config) {
	return new Promise((resolve, reject) => {
		const imap = new Imap(config);

		imap.once('ready', () => {
			console.log(`✅ Connected to ${config.host}`);
			resolve(imap);
		});

		imap.once('error', (err) => {
			console.error(`❌ Connection error to ${config.host}:`, err.message);
			reject(err);
		});

		imap.connect();
	});
}

/**
 * Fetch all emails from a mailbox
 */
function fetchEmails(imap, mailbox) {
	return new Promise((resolve, reject) => {
		imap.openBox(mailbox, true, (err, box) => {
			if (err) {
				reject(err);
				return;
			}

			console.log(`📬 Found ${box.messages.total} messages in ${mailbox}`);

			if (box.messages.total === 0) {
				resolve([]);
				return;
			}

			const fetch = imap.seq.fetch('1:*', {
				bodies: '',
				struct: true,
			});

			const emails = [];

			fetch.on('message', (msg, seqno) => {
				let buffer = '';

				msg.on('body', (stream) => {
					stream.on('data', (chunk) => {
						buffer += chunk.toString('utf8');
					});
				});

				msg.once('end', () => {
					emails.push({ seqno, raw: buffer });
				});
			});

			fetch.once('error', reject);

			fetch.once('end', () => {
				console.log(`✅ Fetched ${emails.length} emails`);
				resolve(emails);
			});
		});
	});
}

/**
 * Upload email to Zoho via IMAP APPEND
 */
async function uploadToZoho(emailData, zohoImap) {
	const parsed = await simpleParser(emailData.raw);

	if (DRY_RUN) {
		console.log(`[DRY RUN] Would upload: ${parsed.subject} (${parsed.date})`);
		return { success: true, dryRun: true };
	}

	return new Promise((resolve) => {
		zohoImap.append(emailData.raw, { mailbox: 'INBOX', flags: ['\\Seen'] }, (err) => {
			if (err) {
				resolve({ success: false, error: err.message });
			} else {
				resolve({ success: true });
			}
		});
	});
}

/**
 * Main migration function
 */
async function migrateEmails() {
	console.log('🚀 Starting email migration for orders@puretide.ca...\n');

	if (!OLD_SERVER.password) {
		console.error('❌ ERROR: Please set OLD_SERVER.password in the script');
		console.error('   This is your password for mail.puretide.ca\n');
		process.exit(1);
	}

	if (DRY_RUN) {
		console.log('⚠️  DRY RUN MODE - No emails will be migrated');
		console.log('   Set DRY_RUN = false to perform actual migration\n');
	}

	let oldImap, zohoImap;

	try {
		// Connect to old server
		console.log('📡 Connecting to old server (mail.puretide.ca)...');
		oldImap = await connectImap(OLD_SERVER);

		// Fetch emails from old server
		console.log(`\n📥 Fetching emails from ${MAILBOX}...`);
		const emails = await fetchEmails(oldImap, MAILBOX);

		if (emails.length === 0) {
			console.log('✅ No emails to migrate');
			oldImap.end();
			return;
		}

		// Connect to Zoho IMAP
		if (!DRY_RUN) {
			console.log('\n📡 Connecting to Zoho IMAP...');
			zohoImap = await connectImap(ZOHO_IMAP);
		}

		// Migrate emails in batches
		console.log(`\n📤 Migrating ${emails.length} emails to Zoho...`);
		let migrated = 0;
		let failed = 0;

		for (let i = 0; i < emails.length; i += BATCH_SIZE) {
			const batch = emails.slice(i, i + BATCH_SIZE);
			console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(emails.length / BATCH_SIZE)}...`);

			for (const email of batch) {
				const result = await uploadToZoho(email, zohoImap);

				if (result.success) {
					migrated++;
					process.stdout.write('.');
				} else {
					failed++;
					process.stdout.write('x');
					console.error(`\n❌ Failed to migrate email: ${result.error}`);
				}
			}

			// Small delay between batches
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		console.log('\n\n✅ Migration complete!');
		console.log(`   Migrated: ${migrated}`);
		console.log(`   Failed: ${failed}`);

		if (DRY_RUN) {
			console.log('\n⚠️  This was a DRY RUN - no emails were actually migrated');
			console.log('   Set DRY_RUN = false to perform actual migration');
		}
	} catch (error) {
		console.error('\n❌ Migration failed:', error.message);
		throw error;
	} finally {
		if (oldImap) oldImap.end();
		if (zohoImap) zohoImap.end();
	}
}

// Run migration
migrateEmails().catch(console.error);

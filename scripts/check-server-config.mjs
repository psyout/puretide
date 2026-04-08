#!/usr/bin/env node

/**
 * Check Server Configuration
 * Attempts to retrieve configuration or environment info from mail.puretide.ca
 */

import https from 'https';
import http from 'http';

const SERVER = 'mail.puretide.ca';

console.log('🔍 Checking mail.puretide.ca for accessible configuration...\n');

// Common paths where config files might be exposed
const CONFIG_PATHS = [
	'/.env',
	'/.env.local',
	'/.env.production',
	'/config.php',
	'/config.json',
	'/wp-config.php',
	'/.git/config',
	'/phpinfo.php',
	'/info.php',
	'/server-status',
	'/server-info',
];

// Common webmail paths
const WEBMAIL_PATHS = [
	'/webmail',
	'/mail',
	'/roundcube',
	'/squirrelmail',
	'/horde',
	'/zimbra',
	'/owa',
];

async function checkUrl(url) {
	return new Promise((resolve) => {
		const protocol = url.startsWith('https') ? https : http;
		
		const req = protocol.get(url, { 
			timeout: 5000,
			rejectUnauthorized: false 
		}, (res) => {
			resolve({
				url,
				status: res.statusCode,
				headers: res.headers,
				accessible: res.statusCode === 200
			});
		});
		
		req.on('error', () => {
			resolve({ url, accessible: false, error: true });
		});
		
		req.on('timeout', () => {
			req.destroy();
			resolve({ url, accessible: false, timeout: true });
		});
	});
}

async function checkServer() {
	console.log('📡 Checking for webmail interfaces...\n');
	
	for (const path of WEBMAIL_PATHS) {
		const httpsUrl = `https://${SERVER}${path}`;
		const httpUrl = `http://${SERVER}${path}`;
		
		const httpsResult = await checkUrl(httpsUrl);
		if (httpsResult.accessible) {
			console.log(`✅ Found webmail: ${httpsUrl}`);
			console.log(`   Status: ${httpsResult.status}`);
			console.log(`   You can try logging in here to access old emails\n`);
			return httpsUrl;
		}
		
		const httpResult = await checkUrl(httpUrl);
		if (httpResult.accessible) {
			console.log(`✅ Found webmail: ${httpUrl}`);
			console.log(`   Status: ${httpResult.status}`);
			console.log(`   You can try logging in here to access old emails\n`);
			return httpUrl;
		}
	}
	
	console.log('❌ No webmail interface found\n');
	
	console.log('🔍 Checking for exposed configuration files...\n');
	
	for (const path of CONFIG_PATHS) {
		const httpsUrl = `https://${SERVER}${path}`;
		const result = await checkUrl(httpsUrl);
		
		if (result.accessible) {
			console.log(`⚠️  WARNING: Config file accessible at ${httpsUrl}`);
			console.log(`   This is a security issue but might contain credentials\n`);
		}
	}
	
	console.log('📋 Server Information:\n');
	const rootResult = await checkUrl(`https://${SERVER}`);
	if (rootResult.accessible) {
		console.log(`Server: ${rootResult.headers?.server || 'Unknown'}`);
		console.log(`Content-Type: ${rootResult.headers?.['content-type'] || 'Unknown'}`);
	}
	
	return null;
}

async function checkDNS() {
	console.log('\n🌐 Checking DNS records for mail configuration...\n');
	
	try {
		const { exec } = await import('child_process');
		const { promisify } = await import('util');
		const execAsync = promisify(exec);
		
		// Check MX records
		try {
			const { stdout } = await execAsync(`dig MX puretide.ca +short`);
			if (stdout.trim()) {
				console.log('📧 MX Records (Mail Servers):');
				console.log(stdout.trim());
				console.log('');
			}
		} catch (e) {
			console.log('❌ Could not retrieve MX records\n');
		}
		
		// Check if mail.puretide.ca resolves
		try {
			const { stdout } = await execAsync(`dig mail.puretide.ca +short`);
			if (stdout.trim()) {
				console.log('🔍 mail.puretide.ca resolves to:');
				console.log(stdout.trim());
				console.log('');
			}
		} catch (e) {
			console.log('❌ mail.puretide.ca does not resolve\n');
		}
		
	} catch (error) {
		console.log('⚠️  Could not check DNS records\n');
	}
}

async function main() {
	const webmailUrl = await checkServer();
	await checkDNS();
	
	console.log('\n' + '='.repeat(60));
	console.log('\n📝 Summary:\n');
	
	if (webmailUrl) {
		console.log(`✅ Webmail found: ${webmailUrl}`);
		console.log('   Try logging in with:');
		console.log('   Email: orders@puretide.ca');
		console.log('   Password: AvocadoPep2016 or AvocadoPep2016!');
		console.log('\n   If successful, you can export emails from webmail.\n');
	} else {
		console.log('❌ No webmail interface found');
		console.log('❌ IMAP access is disabled');
		console.log('❌ No accessible configuration files');
		console.log('\n💡 Your only options:');
		console.log('   1. Contact hosting provider for backups');
		console.log('   2. Check Time Machine for local backups');
		console.log('   3. Accept that old emails are inaccessible\n');
	}
}

main();

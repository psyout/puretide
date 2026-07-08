import 'dotenv/config';

const WRIKE_API_BASE = 'https://www.wrike.com/api/v4';
const WRIKE_API_TOKEN = process.env.WRIKE_API_TOKEN;
const WRIKE_ORDERS_FOLDER_ID = process.env.WRIKE_ORDERS_FOLDER_ID;

async function getTasksInFolder(folderId) {
	const response = await fetch(`${WRIKE_API_BASE}/folders/${folderId}/tasks`, {
		headers: { Authorization: `Bearer ${WRIKE_API_TOKEN}` },
	});
	if (!response.ok) {
		console.error('Error fetching tasks:', response.status, await response.text());
		return [];
	}
	const data = await response.json();
	return data.data ?? [];
}

async function getTaskDetails(taskId) {
	const response = await fetch(`${WRIKE_API_BASE}/tasks/${taskId}`, {
		headers: { Authorization: `Bearer ${WRIKE_API_TOKEN}` },
	});
	if (!response.ok) {
		console.error('Error fetching task details:', response.status, await response.text());
		return null;
	}
	const data = await response.json();
	return data.data?.[0] ?? null;
}

async function main() {
	console.log('Searching Wrike for order d437bbda7c or Emma Dame...');

	const tasks = await getTasksInFolder(WRIKE_ORDERS_FOLDER_ID);
	console.log(`Found ${tasks.length} tasks in orders folder`);

	// Search for order by number or customer name
	const matchingTasks = tasks.filter((task) => {
		const title = task.title || '';
		const description = task.description || '';
		return title.includes('d437bbda7c') || title.includes('Emma') || description.includes('Emma') || description.includes('emmadame4@gmail.com') || description.includes('d437bbda7c');
	});

	console.log(`\nFound ${matchingTasks.length} matching tasks:`);

	for (const task of matchingTasks) {
		console.log('\n--- Task ---');
		console.log('ID:', task.id);
		console.log('Title:', task.title);

		// Fetch full details including description
		const details = await getTaskDetails(task.id);
		if (details) {
			console.log('Description:', details.description || 'No description');
			if (details.customFields) {
				console.log('Custom Fields:', JSON.stringify(details.customFields, null, 2));
			}
		}
	}

	// Also show recent tasks if no match
	if (matchingTasks.length === 0) {
		console.log('\nNo exact matches. Showing last 10 tasks:');
		const recentTasks = tasks.slice(-10).reverse();
		for (const task of recentTasks) {
			console.log('\n--- Task ---');
			console.log('ID:', task.id);
			console.log('Title:', task.title);
		}
	}
}

main().catch(console.error);

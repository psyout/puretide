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
	console.log('Searching Wrike for orders d437bbda7c, 594fa6a48a, f3b494afcc...');
	
	const tasks = await getTasksInFolder(WRIKE_ORDERS_FOLDER_ID);
	console.log(`Found ${tasks.length} tasks in orders folder`);
	
	// Search for order by number
	const targetOrders = ['d437bbda7c', '594fa6a48a', 'f3b494afcc'];
	const matchingTasks = tasks.filter(task => {
		const title = task.title || '';
		return targetOrders.some(order => title.includes(order));
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
	
	if (matchingTasks.length === 0) {
		console.log('\nNo matching tasks found in Wrike.');
	}
}

main().catch(console.error);

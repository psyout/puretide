import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboardAuth';
import { readSheetClients } from '@/lib/stockSheet';

interface SurveyAnalytics {
	totalClients: number;
	withSurveyData: number;
	withoutSurveyData: number;
	sources: Record<string, number>;
	sourcePercentages: Record<string, number>;
}

function calculateSurveyAnalytics(clients: Array<{ howDidYouHear?: string }>): SurveyAnalytics {
	const totalClients = clients.length;
	const withSurveyData = clients.filter((c) => c.howDidYouHear && c.howDidYouHear.trim()).length;
	const withoutSurveyData = totalClients - withSurveyData;

	const sources: Record<string, number> = {};
	clients.forEach((client) => {
		const source = client.howDidYouHear?.trim() || 'Unknown';
		sources[source] = (sources[source] || 0) + 1;
	});

	const sourcePercentages: Record<string, number> = {};
	Object.entries(sources).forEach(([source, count]) => {
		sourcePercentages[source] = totalClients > 0 ? Math.round((count / totalClients) * 100) : 0;
	});

	return {
		totalClients,
		withSurveyData,
		withoutSurveyData,
		sources,
		sourcePercentages,
	};
}

export async function GET(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;
	try {
		const clients = await readSheetClients();
		const surveyAnalytics = calculateSurveyAnalytics(clients);
		return NextResponse.json({ ok: true, clients, surveyAnalytics });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to read clients';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}

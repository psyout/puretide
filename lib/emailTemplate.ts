const COLORS = {
	background: '#f3f7f6',
	brand: '#1e5260',
	ink: '#173f3b',
	muted: '#667b78',
	border: '#dce8e6',
	soft: '#edf5f3',
};

export function escapeEmailHtml(value: unknown): string {
	return String(value ?? '').replace(/[&<>'"]/g, (character) => {
		const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
		return entities[character] ?? character;
	});
}

export function getEmailBaseUrl(): string {
	return String(process.env.APP_BASE_URL ?? process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://puretide.ca').replace(/\/$/, '');
}

export function emailSectionTitle(title: string): string {
	return `<h2 style="margin:26px 0 10px;color:${COLORS.brand};font-family:Arial,sans-serif;font-size:18px;line-height:1.3">${escapeEmailHtml(title)}</h2>`;
}

export function emailInfoBox(content: string, accent = false): string {
	return `<div style="margin:18px 0;padding:18px 20px;background:${COLORS.background};${accent ? `border-left:4px solid ${COLORS.brand};` : `border:1px solid ${COLORS.border};`}border-radius:8px">${content}</div>`;
}

export function emailButton(label: string, url: string): string {
	return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0"><tr><td style="border-radius:8px;background:${COLORS.brand}"><a href="${escapeEmailHtml(url)}" style="display:inline-block;padding:13px 22px;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none">${escapeEmailHtml(label)}</a></td></tr></table>`;
}

export function buildBrandedEmail(input: {
	title: string;
	preheader?: string;
	status?: string;
	headerLabel?: string;
	bodyHtml: string;
	footerHtml?: string;
}): string {
	const logoUrl = `${getEmailBaseUrl()}/logo.svg`;
	const preheader = input.preheader
		? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeEmailHtml(input.preheader)}</div>`
		: '';
	const status = input.status
		? `<div style="margin:0 0 12px"><span style="display:inline-block;padding:6px 10px;border-radius:999px;background:${COLORS.soft};color:${COLORS.brand};font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase">${escapeEmailHtml(input.status)}</span></div>`
		: '';
	const footer = input.footerHtml ?? `Questions? Reply to this email or contact <a href="mailto:info@puretide.ca" style="color:${COLORS.brand}">info@puretide.ca</a>.`;

	return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeEmailHtml(input.title)}</title></head><body style="margin:0;padding:0;background:${COLORS.background}">${preheader}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLORS.background}"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid ${COLORS.border};border-radius:14px;overflow:hidden"><tr><td style="height:6px;background:${COLORS.brand};font-size:0;line-height:0">&nbsp;</td></tr><tr><td style="padding:26px 32px 20px;border-bottom:1px solid #e5efed"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding-right:14px"><img src="${escapeEmailHtml(logoUrl)}" width="62" alt="Pure Tide" style="display:block;width:62px;height:auto;border:0"></td><td><div style="font-family:Arial,sans-serif;color:${COLORS.brand};font-size:25px;font-weight:700;letter-spacing:.02em">PURE TIDE</div><div style="font-family:Arial,sans-serif;color:${COLORS.muted};font-size:12px;letter-spacing:.08em;text-transform:uppercase">${escapeEmailHtml(input.headerLabel ?? 'Advanced Peptide Wellness')}</div></td></tr></table></td></tr><tr><td style="padding:28px 32px 32px;font-family:Arial,sans-serif;color:${COLORS.ink};font-size:16px;line-height:1.65">${status}<h1 style="margin:0 0 18px;color:${COLORS.ink};font-size:26px;line-height:1.25">${escapeEmailHtml(input.title)}</h1>${input.bodyHtml}</td></tr><tr><td style="padding:20px 32px;background:#f8fbfa;border-top:1px solid #e5efed;font-family:Arial,sans-serif;color:${COLORS.muted};font-size:12px;line-height:1.6;text-align:center">${footer}<br><span style="letter-spacing:.05em">PURE TIDE · ADVANCED PEPTIDE WELLNESS</span></td></tr></table></td></tr></table></body></html>`;
}

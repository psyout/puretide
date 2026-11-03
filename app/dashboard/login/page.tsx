import { isAuth0Configured } from '@/lib/auth0';
import DashboardLoginForm from './DashboardLoginForm';

export default function DashboardLoginPage() {
	return <DashboardLoginForm auth0Configured={isAuth0Configured()} />;
}

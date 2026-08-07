import { Redirect } from 'expo-router';

export default function LegacyStreamingServicesRoute() {
  return <Redirect href={'/profile' as never} />;
}

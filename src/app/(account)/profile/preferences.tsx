import { Redirect } from 'expo-router';

export default function LegacyProfilePreferencesRoute() {
  return <Redirect href={'/profile' as never} />;
}

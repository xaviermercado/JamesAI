import { Redirect } from 'expo-router';

export default function LegacyProfileEditRoute() {
  return <Redirect href={'/profile' as never} />;
}

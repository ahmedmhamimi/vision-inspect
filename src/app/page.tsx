/**
 * page.tsx (app root)
 * Redirects immediately to /visioninspect — the pilot has exactly one feature, so a
 * separate landing page would only add a click between the user and the actual tool.
 */
import { redirect } from 'next/navigation';

export default function RootPage(): never {
  redirect('/visioninspect');
}

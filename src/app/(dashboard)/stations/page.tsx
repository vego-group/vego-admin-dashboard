'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The old Stations page was an orphan copy of Battery Swapping, missing from
 * the menu and showing invented figures ("In Use 0", NaN%) (FA-332). The
 * address is kept for old bookmarks and leads to the real page.
 */
export default function StationsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/battery-swapping');
  }, [router]);
  return null;
}

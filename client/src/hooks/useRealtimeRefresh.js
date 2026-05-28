import { useEffect, useRef } from 'react';
import { onSocketEvents, onSocketConnect } from '../services/socket';

// Subscribe a dashboard to real-time change events. When any of `events`
// arrives (optionally filtered by year), the `refetch` callback runs,
// debounced + coalesced so a burst (e.g. a bulk paste) triggers a single
// refetch. Also refetches once on (re)connect to catch missed events.
//
//   useRealtimeRefresh(
//     ['teamEntry:upserted', 'teamEntry:bulk', 'consultant:created'],
//     loadData,
//     { year }
//   )
//
// Degrades silently: if the socket never connects, the page still works
// via its normal mount/effect fetch.
export default function useRealtimeRefresh(events, refetch, { year, debounceMs = 500 } = {}) {
    const refetchRef = useRef(refetch);
    refetchRef.current = refetch;
    const yearRef = useRef(year);
    yearRef.current = year;

    useEffect(() => {
        let timer = null;
        const schedule = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                timer = null;
                if (typeof refetchRef.current === 'function') refetchRef.current();
            }, debounceMs);
        };

        const handler = (payload) => {
            // Ignore events for a year the user isn't currently viewing.
            if (payload && payload.year && yearRef.current && payload.year !== yearRef.current) return;
            schedule();
        };

        const offEvents = onSocketEvents(events, handler);
        const offConnect = onSocketConnect(schedule);

        return () => {
            if (timer) clearTimeout(timer);
            offEvents();
            offConnect();
        };
        // events is a stable literal array at call sites; stringify to be safe.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(events), debounceMs]);
}

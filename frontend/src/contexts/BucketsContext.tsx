import {createContext, useContext, useEffect, useState} from 'react';
import type {Bucket, BucketStats} from '@shared/types';
import {fetchBuckets, fetchBucketStats} from '../api/client';

interface BucketsContextValue {
	buckets: Bucket[];
	statsMap: Map<string, BucketStats>;
	bucketsLoading: boolean;
}

const defaultValue: BucketsContextValue = {
	buckets: [],
	statsMap: new Map(),
	bucketsLoading: true,
};

export const BucketsContext = createContext<BucketsContextValue>(defaultValue);

export const useBuckets = () => useContext(BucketsContext);

export const BucketsProvider = ({children}: {children: React.ReactNode}) => {
	const [buckets, setBuckets] = useState<Bucket[]>([]);
	const [statsMap, setStatsMap] = useState<Map<string, BucketStats>>(new Map());
	const [bucketsLoading, setBucketsLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		void fetchBuckets()
			.then((loaded) => {
				if (cancelled) {
					return;
				}
				setBuckets(loaded);
				setBucketsLoading(false);
				for (const b of loaded) {
					void fetchBucketStats(b.name)
						.then((stats) => {
							if (!cancelled) {
								setStatsMap((prev) => new Map(prev).set(b.name, stats));
							}
						})
						.catch(() => {
							/* ignore per-bucket stats errors */
						});
				}
			})
			.catch(() => {
				if (!cancelled) {
					setBucketsLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<BucketsContext.Provider value={{buckets, statsMap, bucketsLoading}}>
			{children}
		</BucketsContext.Provider>
	);
};

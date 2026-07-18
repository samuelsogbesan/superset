/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { t } from '@apache-superset/core/translation';
import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import { Dispatch, SetStateAction } from 'react';

interface FetchPaginatedOptions {
  endpoint: string;
  pageSize?: number;
  setData: (data: any[]) => void;
  setLoadingState: Dispatch<SetStateAction<any>>;
  filters?: SupersetFilter[];
  orderBy?: { column: string; direction: 'asc' | 'desc' };
  loadingKey: string;
  addDangerToast: (message: string) => void;
  errorMessage?: string;
  mapResult?: (item: any) => any;
}

interface QueryObj {
  page_size: number;
  page: number;
  filters?: SupersetFilter[];
  order_column?: string;
  order_direction?: 'asc' | 'desc';
}

interface SupersetFilter {
  col: string;
  opr: string;
  value: string | number | (string | number)[];
}

export const fetchPaginatedData = async ({
  endpoint,
  pageSize = 100,
  setData,
  filters,
  orderBy,
  setLoadingState,
  loadingKey,
  addDangerToast,
  errorMessage = 'Error while fetching data',
  mapResult = (item: any) => item,
}: FetchPaginatedOptions) => {
  try {
    // A deterministic order is required so that paginated LIMIT/OFFSET queries
    // return a stable slice on every page. Without it the backend can return
    // the same record on multiple pages (and skip others), which surfaces as
    // duplicate entries once the pages are concatenated.
    const order = orderBy ?? { column: 'id', direction: 'asc' as const };

    const fetchPage = async (pageIndex: number) => {
      const queryObj: QueryObj = {
        page_size: pageSize,
        page: pageIndex,
        order_column: order.column,
        order_direction: order.direction,
      };
      if (filters) {
        queryObj.filters = filters;
      }
      const encodedQuery = rison.encode(queryObj);

      const response = await SupersetClient.get({
        endpoint: `${endpoint}?q=${encodedQuery}`,
      });

      return {
        count: response.json.count,
        results: response.json.result as any[],
      };
    };

    const seenIds = new Set<unknown>();
    const dedupe = (rawResults: any[]) =>
      rawResults.filter(item => {
        const key = item?.id ?? item;
        if (seenIds.has(key)) {
          return false;
        }
        seenIds.add(key);
        return true;
      });

    const initialResponse = await fetchPage(0);
    const totalItems = initialResponse.count;
    const firstPageResults = dedupe(initialResponse.results);

    if (pageSize >= totalItems) {
      setData(firstPageResults.map(mapResult));
      return;
    }

    const totalPages = Math.ceil(totalItems / pageSize);
    const concurrencyLimit = 5;
    const allResults = [...firstPageResults];

    for (let batch = 1; batch < totalPages; batch += concurrencyLimit) {
      const batchEnd = Math.min(batch + concurrencyLimit, totalPages);
      // eslint-disable-next-line no-await-in-loop
      const batchResults = await Promise.all(
        Array.from({ length: batchEnd - batch }, (_, i) =>
          fetchPage(batch + i),
        ),
      );
      allResults.push(...dedupe(batchResults.flatMap(res => res.results)));
    }

    setData(allResults.map(mapResult));
  } catch (err) {
    addDangerToast(t(errorMessage));
  } finally {
    setLoadingState((prev: boolean | Record<string, boolean>) => {
      if (typeof prev === 'boolean') {
        return false;
      }
      return {
        ...prev,
        [loadingKey]: false,
      };
    });
  }
};

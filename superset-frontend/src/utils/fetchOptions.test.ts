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
import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import { fetchPaginatedData } from './fetchOptions';

const getMock = jest.spyOn(SupersetClient, 'get');

afterEach(() => {
  getMock.mockReset();
});

const decodeQuery = (endpoint: string) =>
  rison.decode(endpoint.split('?q=')[1]) as Record<string, unknown>;

test('sends a stable default order_column when orderBy is omitted', async () => {
  getMock.mockResolvedValue({
    json: { count: 1, result: [{ id: 1, name: 'A' }] },
  } as any);
  const setData = jest.fn();
  const setLoadingState = jest.fn();
  const addDangerToast = jest.fn();

  await fetchPaginatedData({
    endpoint: '/api/v1/security/roles/',
    setData,
    setLoadingState,
    loadingKey: 'roles',
    addDangerToast,
  });

  const query = decodeQuery(
    (getMock.mock.calls[0][0] as { endpoint: string }).endpoint,
  );
  // Without a deterministic order, paginated LIMIT/OFFSET queries can return
  // the same row on multiple pages, producing duplicates in the UI.
  expect(query.order_column).toBe('id');
  expect(query.order_direction).toBe('asc');
});

test('respects an explicit orderBy over the default', async () => {
  getMock.mockResolvedValue({
    json: { count: 1, result: [{ id: 1, name: 'A' }] },
  } as any);

  await fetchPaginatedData({
    endpoint: '/api/v1/security/roles/',
    setData: jest.fn(),
    setLoadingState: jest.fn(),
    loadingKey: 'roles',
    addDangerToast: jest.fn(),
    orderBy: { column: 'name', direction: 'desc' },
  });

  const query = decodeQuery(
    (getMock.mock.calls[0][0] as { endpoint: string }).endpoint,
  );
  expect(query.order_column).toBe('name');
  expect(query.order_direction).toBe('desc');
});

test('deduplicates records that appear on more than one page', async () => {
  const pageSize = 100;
  const totalCount = 150;
  const makeItems = (startId: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: startId + i,
      name: `item_${startId + i}`,
    }));

  getMock.mockImplementation(({ endpoint }: { endpoint: string }) => {
    const query = decodeQuery(endpoint);
    // Simulate unstable pagination where page 1 overlaps page 0 (ids 51-100
    // repeat) — the exact symptom reported when many rows span pages.
    const result = query.page === 0 ? makeItems(1, 100) : makeItems(51, 100);
    return Promise.resolve({
      json: { count: totalCount, result },
    } as any);
  });

  const setData = jest.fn();

  await fetchPaginatedData({
    endpoint: '/api/v1/security/roles/',
    pageSize,
    setData,
    setLoadingState: jest.fn(),
    loadingKey: 'roles',
    addDangerToast: jest.fn(),
  });

  const data = setData.mock.calls[0][0] as { id: number }[];
  const ids = data.map(item => item.id);
  const uniqueIds = new Set(ids);
  expect(ids.length).toBe(uniqueIds.size);
  expect(uniqueIds.size).toBe(totalCount);
});

test('deduplicates using mapped result identity', async () => {
  getMock.mockImplementation(({ endpoint }: { endpoint: string }) => {
    const query = decodeQuery(endpoint);
    const result =
      query.page === 0
        ? [
            { id: 1, name: 'A' },
            { id: 2, name: 'B' },
          ]
        : [
            { id: 2, name: 'B' },
            { id: 3, name: 'C' },
          ];
    return Promise.resolve({ json: { count: 3, result } } as any);
  });

  const setData = jest.fn();

  await fetchPaginatedData({
    endpoint: '/api/v1/security/groups/',
    pageSize: 2,
    setData,
    setLoadingState: jest.fn(),
    loadingKey: 'groups',
    addDangerToast: jest.fn(),
    mapResult: (item: { id: number; name: string }) => ({
      value: item.id,
      label: item.name,
    }),
  });

  const data = setData.mock.calls[0][0] as { value: number }[];
  const values = data.map(item => item.value);
  expect(values).toEqual([1, 2, 3]);
});

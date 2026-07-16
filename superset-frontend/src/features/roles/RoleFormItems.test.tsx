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
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { fetchPermissionOptions } from './utils';
import {
  RoleNameField,
  PermissionsField,
  UsersField,
  GroupsField,
} from './RoleFormItems';

jest.mock('./utils', () => ({
  fetchPermissionOptions: jest.fn(),
  fetchGroupOptions: jest.fn(),
}));

jest.mock('../groups/utils', () => ({
  fetchUserOptions: jest.fn(),
}));

const addDangerToast = jest.fn();
const fetchPermissionOptionsMock =
  fetchPermissionOptions as jest.MockedFunction<typeof fetchPermissionOptions>;

afterEach(() => {
  jest.clearAllMocks();
});

test('RoleNameField renders label and input', () => {
  render(<RoleNameField />);
  expect(screen.getByText('Role Name')).toBeInTheDocument();
  expect(screen.getByTestId('role-name-input')).toBeInTheDocument();
});

test('PermissionsField renders label and select', () => {
  render(<PermissionsField addDangerToast={addDangerToast} />);
  expect(screen.getByText('Permissions')).toBeInTheDocument();
  expect(screen.getByTestId('permissions-select')).toBeInTheDocument();
});

test('PermissionsField renders loading state', () => {
  render(<PermissionsField addDangerToast={addDangerToast} loading />);
  expect(screen.getByText('Permissions')).toBeInTheDocument();
  expect(screen.getByTestId('permissions-select')).toBeInTheDocument();
});

test('PermissionsField displays server-filtered results for underscore searches', async () => {
  fetchPermissionOptionsMock.mockResolvedValue({
    data: [{ value: 1, label: 'can read data_prod' }],
    totalCount: 1,
  });
  render(<PermissionsField addDangerToast={addDangerToast} />);

  const select = screen.getByRole('combobox', { name: 'rolePermissions' });
  await userEvent.click(select);
  await screen.findByText('can read data_prod');
  await userEvent.type(select, 'can_read');

  await waitFor(() =>
    expect(
      document.querySelectorAll('.ant-select-item-option-content'),
    ).toHaveLength(1),
  );
});

test('UsersField renders label and select', () => {
  render(<UsersField addDangerToast={addDangerToast} loading={false} />);
  expect(screen.getByText('Users')).toBeInTheDocument();
  expect(screen.getByTestId('roles-select')).toBeInTheDocument();
});

test('GroupsField renders label and select', () => {
  render(<GroupsField addDangerToast={addDangerToast} />);
  expect(screen.getByText('Groups')).toBeInTheDocument();
  expect(screen.getByTestId('groups-select')).toBeInTheDocument();
});

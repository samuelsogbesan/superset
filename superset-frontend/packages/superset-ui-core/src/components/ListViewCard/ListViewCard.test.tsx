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
import fetchMock from 'fetch-mock';

import { render, screen, userEvent, waitFor } from '@superset-ui/core/spec';
import { ListViewCard } from '.';

global.URL.createObjectURL = jest.fn(() => '/local_url');
fetchMock.get('/thumbnail', { body: new Blob(), sendAsJson: false });

describe('ListViewCard', () => {
  const defaultProps = {
    title: 'Card Title',
    loading: false,
    url: '/card-url',
    imgURL: '/thumbnail',
    imgFallbackURL: '/fallback',
    description: 'Card Description',
    coverLeft: 'Left Text',
    coverRight: 'Right Text',
    actions: (
      <ListViewCard.Actions>
        <div>Action 1</div>
        <div>Action 2</div>
      </ListViewCard.Actions>
    ),
  };

  beforeEach(() => {
    const props = { ...defaultProps };
    render(<ListViewCard {...props} />);
  });

  test('is a valid element', () => {
    expect(screen.getByTestId('styled-card')).toBeInTheDocument();
  });

  test('renders Actions', () => {
    expect(screen.getByTestId('card-actions')).toBeVisible();
    expect(screen.getByText('Action 1')).toBeVisible();
    expect(screen.getByText('Action 2')).toBeVisible();
  });

  test('renders an ImageLoader', () => {
    expect(screen.getByTestId('image-loader')).toBeVisible();
  });

  test('truncates a long description to a single line', () => {
    const longDescription =
      'Geändert vor ungefähr einem Monat, drei Wochen und zwei Tagen';
    render(<ListViewCard {...defaultProps} description={longDescription} />);
    const description = screen.getByText(longDescription);
    expect(description).toHaveStyle({
      overflow: 'hidden',
      'text-overflow': 'ellipsis',
      'white-space': 'nowrap',
    });
  });

  test('exposes the full description in a tooltip on hover', async () => {
    const longDescription =
      'Geändert vor ungefähr einem Monat, drei Wochen und zwei Tagen';
    render(<ListViewCard {...defaultProps} description={longDescription} />);
    userEvent.hover(screen.getByText(longDescription));
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent(longDescription);
    });
  });
});

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
import getUserName from 'src/utils/getUserName';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { useCSSTextTruncation } from '@superset-ui/core';
import { Tooltip } from '@superset-ui/core/components';
import type { AuditInfoProps } from './types';

const TruncatedDate = styled.span`
  display: inline-block;
  max-width: 100%;
  vertical-align: bottom;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AuditLabel = ({
  user,
  date,
  action,
}: AuditInfoProps & { action: 'created' | 'modified' }) => {
  const [dateRef, isDateTruncated] = useCSSTextTruncation<HTMLSpanElement>();

  const dateSpan = (
    <TruncatedDate ref={dateRef} data-test="audit-info-date">
      {date}
    </TruncatedDate>
  );

  const byLine = user
    ? action === 'created'
      ? t('Created by: %s', getUserName(user))
      : t('Modified by: %s', getUserName(user))
    : undefined;

  // Expose the full timestamp when it is truncated and always surface the
  // authoring user, so long localized dates remain fully accessible.
  const title =
    isDateTruncated || byLine ? (
      <>
        {isDateTruncated && <div>{date}</div>}
        {byLine && <div>{byLine}</div>}
      </>
    ) : null;

  if (!title) {
    return dateSpan;
  }

  return (
    <Tooltip title={title} placement="bottom">
      {dateSpan}
    </Tooltip>
  );
};

export const ModifiedInfo = ({ user, date }: AuditInfoProps) => (
  <AuditLabel user={user} date={date} action="modified" />
);

export const CreatedInfo = ({ user, date }: AuditInfoProps) => (
  <AuditLabel user={user} date={date} action="created" />
);

export type { AuditInfoProps };

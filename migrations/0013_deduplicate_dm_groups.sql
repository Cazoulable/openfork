-- Remove duplicate DM groups that have the same member set.
-- Keep the oldest group (earliest created_at) and delete the rest,
-- moving any messages from duplicates to the kept group.

-- Step 1: Identify duplicate sets and the group to keep (oldest)
WITH member_sets AS (
  SELECT group_id,
         ARRAY_AGG(user_id ORDER BY user_id) AS members
  FROM direct_message_members
  GROUP BY group_id
),
duplicates AS (
  SELECT members,
         MIN(g.created_at) AS min_created,
         ARRAY_AGG(ms.group_id ORDER BY g.created_at) AS group_ids
  FROM member_sets ms
  JOIN direct_message_groups g ON g.id = ms.group_id
  GROUP BY members
  HAVING COUNT(*) > 1
),
keep_and_remove AS (
  SELECT group_ids[1] AS keep_id,
         UNNEST(group_ids[2:]) AS remove_id
  FROM duplicates
)
-- Step 2: Move messages from duplicates to the kept group
UPDATE direct_messages dm
SET group_id = kr.keep_id
FROM keep_and_remove kr
WHERE dm.group_id = kr.remove_id;

-- Step 3: Delete duplicate group members
WITH member_sets AS (
  SELECT group_id,
         ARRAY_AGG(user_id ORDER BY user_id) AS members
  FROM direct_message_members
  GROUP BY group_id
),
duplicates AS (
  SELECT members,
         ARRAY_AGG(ms.group_id ORDER BY g.created_at) AS group_ids
  FROM member_sets ms
  JOIN direct_message_groups g ON g.id = ms.group_id
  GROUP BY members
  HAVING COUNT(*) > 1
),
to_remove AS (
  SELECT UNNEST(group_ids[2:]) AS remove_id FROM duplicates
)
DELETE FROM direct_message_members
WHERE group_id IN (SELECT remove_id FROM to_remove);

-- Step 4: Delete duplicate groups
WITH member_sets AS (
  SELECT group_id,
         ARRAY_AGG(user_id ORDER BY user_id) AS members
  FROM direct_message_members
  GROUP BY group_id
),
duplicates AS (
  SELECT members,
         ARRAY_AGG(ms.group_id ORDER BY g.created_at) AS group_ids
  FROM member_sets ms
  JOIN direct_message_groups g ON g.id = ms.group_id
  GROUP BY members
  HAVING COUNT(*) > 1
),
to_remove AS (
  SELECT UNNEST(group_ids[2:]) AS remove_id FROM duplicates
)
DELETE FROM direct_message_groups
WHERE id IN (SELECT remove_id FROM to_remove);

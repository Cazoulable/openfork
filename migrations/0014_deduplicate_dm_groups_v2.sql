-- Simpler deduplication: find groups with identical member sets,
-- keep the one with the earliest created_at, delete the rest.

DO $$
DECLARE
  dup RECORD;
  keep_id UUID;
  remove_id UUID;
BEGIN
  -- Find all pairs of groups that share the exact same member set
  FOR dup IN
    SELECT a.group_id AS group_a, b.group_id AS group_b
    FROM (
      SELECT group_id, ARRAY_AGG(user_id ORDER BY user_id) AS members
      FROM direct_message_members
      GROUP BY group_id
    ) a
    JOIN (
      SELECT group_id, ARRAY_AGG(user_id ORDER BY user_id) AS members
      FROM direct_message_members
      GROUP BY group_id
    ) b ON a.members = b.members AND a.group_id < b.group_id
  LOOP
    keep_id := dup.group_a;
    remove_id := dup.group_b;

    -- Move messages from duplicate to the kept group
    UPDATE direct_messages SET group_id = keep_id WHERE group_id = remove_id;

    -- Delete duplicate members and group
    DELETE FROM direct_message_members WHERE group_id = remove_id;
    DELETE FROM direct_message_groups WHERE id = remove_id;

    RAISE NOTICE 'Merged DM group % into %', remove_id, keep_id;
  END LOOP;
END $$;

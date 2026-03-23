-- Fix seed user handles to be clean (without ID suffix)
UPDATE users SET handle = 'alice'   WHERE email = 'owner@gmail.com';
UPDATE users SET handle = 'bob'     WHERE email = 'member1@gmail.com';
UPDATE users SET handle = 'charlie' WHERE email = 'member2@gmail.com';
UPDATE users SET handle = 'zero'    WHERE email = 'zero@gmail.com';

-- Also fix display names from original seed
UPDATE users SET display_name = 'Alice Chen',    first_name = 'Alice',   last_name = 'Chen'     WHERE email = 'owner@gmail.com';
UPDATE users SET display_name = 'Bob Martinez',  first_name = 'Bob',     last_name = 'Martinez' WHERE email = 'member1@gmail.com';
UPDATE users SET display_name = 'Charlie Kim',   first_name = 'Charlie', last_name = 'Kim'      WHERE email = 'member2@gmail.com';
UPDATE users SET display_name = 'Zero Admin',    first_name = 'Zero',    last_name = 'Admin'    WHERE email = 'zero@gmail.com';

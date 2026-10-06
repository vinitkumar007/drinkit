-- Staff (admin / rider) can log in with a password instead of an SMS OTP.
ALTER TABLE users ADD COLUMN password_hash TEXT;

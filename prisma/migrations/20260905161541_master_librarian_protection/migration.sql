-- Master Librarian protection (spec: "Nobody can delete, disable, demote, or
-- change the Master Librarian through the normal application" and "Nobody
-- can promote themselves to Master Librarian"). Enforced here at the database
-- layer so it holds even if application-level checks are ever bypassed or a
-- request is crafted directly against the API.

-- 1. Role is a closed set. Prisma models it as TEXT (not a native enum) so it
--    can be extended by a future migration without an enum-alter dance, but
--    it must still never hold an arbitrary string.
ALTER TABLE "user"
  ADD CONSTRAINT "user_role_check" CHECK (role IN ('STANDARD', 'LIBRARIAN', 'MASTER_LIBRARIAN'));

-- 2. At most one Master Librarian may exist at a time. This also blocks any
--    UPDATE that would promote a second user to Master Librarian while one
--    already exists.
CREATE UNIQUE INDEX "user_single_master_librarian_idx"
  ON "user" (role)
  WHERE role = 'MASTER_LIBRARIAN';

-- 3. Once a row is the Master Librarian, it cannot be demoted, deactivated,
--    or deleted by any UPDATE/DELETE — regardless of which application code
--    path issues it.
CREATE OR REPLACE FUNCTION protect_master_librarian()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'MASTER_LIBRARIAN' THEN
      RAISE EXCEPTION 'The Master Librarian account cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.role = 'MASTER_LIBRARIAN' THEN
    IF NEW.role IS DISTINCT FROM 'MASTER_LIBRARIAN' THEN
      RAISE EXCEPTION 'The Master Librarian account cannot be demoted';
    END IF;
    IF NEW."isActive" IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'The Master Librarian account cannot be disabled';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_master_librarian_trigger
  BEFORE UPDATE OR DELETE ON "user"
  FOR EACH ROW
  EXECUTE FUNCTION protect_master_librarian();

-- Align the foreign key constraint name with the apprentice terminology
ALTER TABLE "host_assignment" RENAME CONSTRAINT "host_assignment_learner_id_user_id_fk" TO "host_assignment_apprentice_id_user_id_fk";

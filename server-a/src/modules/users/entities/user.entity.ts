import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  username: string;

  @Column({ nullable: true })
  displayName: string;

  @Column()
  passwordHash: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ type: "timestamp", nullable: true })
  emailVerifiedAt: Date | null;

  // Keycloak user created from this account (POST /api/v1/auth/keycloak-account)
  @Column({ type: "varchar", nullable: true })
  keycloakUserId: string | null;

  // true once the Keycloak user exists AND has set a password via the email link
  @Column({ default: false })
  isLinkedSSO: boolean;

  @Column("simple-array", { default: "user" })
  roles: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

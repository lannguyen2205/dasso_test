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

  @Column("simple-array", { default: "user" })
  roles: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

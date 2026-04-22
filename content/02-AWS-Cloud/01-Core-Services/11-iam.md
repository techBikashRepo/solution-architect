# IAM — Identity and Access Management

> **Subject**: AWS Cloud · **Group**: ☁️ Core Services · **Topic**: 11 of 12
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is it?

**AWS IAM** is the security layer for AWS. It controls **who** (identity) can do **what** (action) on **which resources** under **what conditions**. Every API call to AWS passes through IAM — no request skips it.

Core principle: **Least Privilege** — grant only the permissions actually needed, nothing more.

---

### 2. Identity Types

| Identity                       | What it is                                                                 | When to use                                                      |
| ------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Root User**                  | Account owner; full power, no restrictions                                 | Initial setup only; then lock away                               |
| **IAM User**                   | A person or application; has credentials                                   | Human users (prefer SSO instead)                                 |
| **IAM Group**                  | Collection of users; policies attached to group                            | Manage permissions for teams                                     |
| **IAM Role**                   | Temporary identity; assumed by AWS services, users, or external identities | EC2, Lambda, ECS, CI/CD; recommended over IAM users for services |
| **Service Account** (via Role) | A role assumed by an AWS service                                           | Lambda, ECS task, EC2 instance                                   |

---

### 3. Policy Types

```
POLICY EVALUATION ORDER (all must allow, none must deny):
  Deny-first: explicit Deny always wins
  Then: check Allow
  Default: implicit Deny (if no Allow found)

POLICY TYPES:
  1. Identity-based policy: attached to user/group/role
     "This role CAN do X"

  2. Resource-based policy: attached to the resource (S3, SQS, KMS, etc.)
     "This resource ALLOWS role Y to do Z"

  3. Permission Boundary: max permissions a user/role can have
     Even if policy allows more, boundary caps it
     Use case: allow devs to create roles but not escalate beyond boundary

  4. SCP (Service Control Policy): org-level guardrail
     Applies to entire AWS account or OU
     Cannot grant permissions; can only RESTRICT
     E.g., prevent deleting CloudTrail, prevent disabling GuardDuty

  5. Session Policy: applied during AssumeRole (further restricts the role)

EXAMPLE IDENTITY-BASED POLICY:
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "s3:GetObject",
          "s3:PutObject"
        ],
        "Resource": "arn:aws:s3:::my-bucket/*"
      },
      {
        "Effect": "Deny",
        "Action": "s3:DeleteObject",
        "Resource": "*"
      }
    ]
  }
```

---

### 4. Roles and AssumeRole

```
WHY ROLES OVER IAM USERS FOR SERVICES:
  IAM User: permanent credentials (access key + secret)
    Problem: secrets rotate manually; if leaked → permanent access
  IAM Role: temporary credentials (via STS AssumeRole)
    Credentials expire (1h by default, max 12h)
    Auto-rotated; no long-lived secrets

ASSUMEROLE FLOW:
  Lambda/EC2/ECS → calls STS AssumeRole
  STS → returns: AccessKeyId, SecretAccessKey, SessionToken (expiry: 1h)
  Lambda uses these to call S3, DynamoDB, etc.
  On expiry: SDK auto-refreshes using the role (transparent to code)

CROSS-ACCOUNT ROLE:
  Account A (CI/CD pipeline) → AssumeRole → Account B (production)
  Account B role has a trust policy:
    {
      "Principal": {"AWS": "arn:aws:iam::ACCOUNT_A_ID:role/deploy-role"},
      "Action": "sts:AssumeRole"
    }
  Account A role has permissions:
    sts:AssumeRole on Account B role ARN

  Use case: single CI/CD account deploys to dev, staging, prod accounts
            no cross-account secrets needed

ROLE CHAINING:
  User assumes Role A → Role A assumes Role B
  Max session duration: 1 hour (not extensible in chaining)
  Use sparingly; prefer direct role assumption
```

---

### 5. Common IAM Patterns

```
1. EC2 INSTANCE PROFILE:
   Attach a role to EC2 instance via instance profile
   EC2 metadata service (169.254.169.254) serves temporary credentials
   SDK auto-discovers: no hardcoded access keys in code EVER

2. LAMBDA EXECUTION ROLE:
   Lambda assumes its execution role per invocation
   Grant only needed permissions:
     S3 read to input-bucket
     DynamoDB write to output-table
     CloudWatch Logs write

3. ECS TASK ROLE:
   Per-task role (different from EC2 instance role)
   Task role: what the container can do (read S3, write DynamoDB)
   Instance role: what ECS agent can do (pull ECR images, log to CloudWatch)
   Always use task role for application permissions — not instance role

4. GITHUB ACTIONS OIDC (no long-lived secrets):
   GitHub → OIDC token → STS AssumeRoleWithWebIdentity → AWS credentials
   No AWS_ACCESS_KEY_ID in GitHub secrets
   Role trust policy:
     Principal: federated identity (GitHub OIDC provider)
     Condition: repo must be my-org/my-repo on branch main
```

---

## PART 2

---

### 6. When IAM Goes Wrong

| Mistake                                   | Risk                          | Fix                                            |
| ----------------------------------------- | ----------------------------- | ---------------------------------------------- |
| Wildcard `*` actions/resources            | Blast radius if compromised   | Specific actions and ARNs                      |
| Long-lived access keys                    | Key leaked → permanent breach | Rotate every 90 days or use roles              |
| No MFA on root and IAM users              | Account takeover              | Enable MFA everywhere                          |
| Attaching `AdministratorAccess` to Lambda | Lambda can do anything        | Least privilege per Lambda                     |
| IAM user credentials in code              | Source code leak → breach     | Use instance/task roles; OIDC                  |
| No SCP guardrails                         | Accidental global deletions   | SCP: deny CloudTrail delete, deny root actions |

---

### 7. IAM Credential Management

```
IAM ACCESS KEY ROTATION (if you must use access keys):
  1. Generate new key (user can have 2 active keys)
  2. Update application to use new key
  3. Verify application works
  4. Deactivate old key (test nothing breaks)
  5. Delete old key after 48h observation

CREDENTIAL AUDIT:
  aws iam generate-credential-report
  → CSV: all users, last key rotation, last MFA use
  Alarm: key not rotated in >90 days
  Alarm: inactive users (no login in >90 days)

IAM ACCESS ANALYZER:
  Scans policies → identifies resources accessible from outside the account
  Detects: public S3 buckets, open SQS queues, overly permissive roles
  Generates least-privilege policies from CloudTrail activity logs
```

---

### 8. AWS Architecture Example

```
MULTI-ACCOUNT IAM ARCHITECTURE:
─────────────────────────────────────────────────────────
  AWS Organizations:
    Management Account (root)
      └── OU: Production
          └── AWS Account: prod-account
      └── OU: Staging
          └── AWS Account: staging-account
      └── AWS Account: security-account (CloudTrail, GuardDuty)
      └── AWS Account: shared-services (CI/CD, ECR registry)

  SCPs (at OU level):
    All OUs: Deny CloudTrail:DeleteTrail
    All OUs: Deny ec2:DisassociateRouteTable in prod VPC
    Production OU: Deny iam:CreateUser (no local IAM users in prod)

  HUMAN ACCESS (via SSO):
    Developer → AWS SSO → AssumeRole in dev account (PowerUser)
    Developer → AWS SSO → AssumeRole in prod account (ReadOnly)
    On-call → AWS SSO → AssumeRole in prod account (Ops role, time-limited)

  CI/CD (GitHub Actions):
    GitHub OIDC → AssumeRole: ci-deploy-role
    ci-deploy-role:
      ECR: PushImage
      ECS: UpdateService, RegisterTaskDefinition
      S3: PutObject to artifacts bucket
      No: IAM:*, no broad EC2:*

  LAMBDA ROLE (per function):
    lambda-order-processor-role:
      Allow: sqs:ReceiveMessage, sqs:DeleteMessage on order-queue
      Allow: dynamodb:PutItem, dynamodb:GetItem on orders table
      Allow: logs:CreateLogGroup, logs:PutLogEvents
      Deny: everything else (implicit)
```

---

### 9. Interview-Ready Explanation (30 sec)

> _"IAM is AWS's authorization layer — every API call is checked against IAM policies. Core principle: least privilege._
>
> _For services: always use roles, never hard-coded access keys. Lambda, EC2, and ECS all assume roles; credentials are temporary, auto-rotated by STS. For cross-account: a trust policy on the target account's role allows the source account to AssumeRole — no secrets needed._
>
> _At scale: use AWS Organizations with SCPs as guardrails (prevent deleting CloudTrail, deny IAM user creation in prod), and AWS SSO for human access. IAM Access Analyzer helps identify overly permissive policies and external access."_

---

### 10. Common Interview Questions

**Q1: How do you give an ECS task permission to read from S3?**

> Create an IAM role with a trust policy allowing `ecs-tasks.amazonaws.com` to assume it. Attach an identity-based policy granting `s3:GetObject` on the specific bucket ARN (not `*`). Assign this role as the **task role** in the ECS task definition (not the EC2 instance role). ECS injects the credentials into the container via the metadata endpoint. The application code needs no access keys — the AWS SDK auto-discovers the task role credentials. Key distinction: task role = what the application inside the container can do; EC2 instance role = what the ECS agent on the host EC2 can do (pull ECR images, write CloudWatch metrics). Never use the EC2 instance role for application permissions.

**Q2: What is the difference between an identity-based policy and a resource-based policy?**

> Identity-based policy: attached to an IAM user, group, or role. Specifies what that identity CAN do. Example: this Lambda role can `s3:GetObject` on bucket X. Resource-based policy: attached to the AWS resource (S3 bucket policy, SQS queue policy, KMS key policy). Specifies WHO can access this resource. Example: this S3 bucket allows `s3:GetObject` from account 123456789. Both types must allow an action for cross-account access to succeed. For same-account access: only one type needs to allow it. Important: S3 bucket policies, SQS queue policies, and KMS key policies are resource-based. Some services (EC2, RDS) don't support resource-based policies — you must use identity-based policies.

**Q3: How would you prevent credential leakage in a CI/CD pipeline?**

> Use OIDC federation — no long-lived secrets at all. GitHub Actions: configure an OIDC provider in AWS IAM pointing to `token.actions.githubusercontent.com`. Create a role with a trust policy that allows `sts:AssumeRoleWithWebIdentity` with a condition that the sub (subject) matches the specific repo and branch (`repo:my-org/my-repo:ref:refs/heads/main`). In the GitHub workflow: use `aws-actions/configure-aws-credentials@v4` with `role-to-assume: arn:aws:iam::xxx:role/ci-role`. GitHub exchanges an OIDC token for short-lived AWS credentials. No `AWS_ACCESS_KEY_ID` in GitHub Secrets. Credentials expire in 1 hour. Even if the OIDC token leaks, it can only be used from GitHub's IP range and for the specific repo/branch condition.

---

> **Next Topic →** [12 · CloudWatch](./12-cloudwatch.md)

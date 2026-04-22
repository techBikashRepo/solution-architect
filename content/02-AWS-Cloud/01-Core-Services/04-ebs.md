# EBS — Amazon Elastic Block Store

> **Subject**: AWS Cloud · **Group**: ☁️ Core Services · **Topic**: 04 of 12
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is it?

**Amazon EBS (Elastic Block Store)** is a high-performance, persistent block storage service designed for use with EC2. Think of it as an external SSD/HDD you can attach to a virtual machine.

Unlike S3 (object storage, accessed via API), EBS behaves like a disk — you format it with a filesystem and mount it.

---

### 2. Key Concepts

| Concept          | Detail                                                                   |
| ---------------- | ------------------------------------------------------------------------ |
| **Volume**       | A persistent disk; exists independently of EC2 instances                 |
| **Attachment**   | Volumes attach to ONE EC2 instance at a time (same AZ)                   |
| **Snapshot**     | Point-in-time backup of an EBS volume (stored in S3)                     |
| **AZ-bound**     | EBS volumes are locked to one Availability Zone                          |
| **Encryption**   | KMS-based encryption at rest (enabled at creation)                       |
| **Multi-Attach** | io1/io2 volumes can attach to multiple EC2 in same AZ (with limitations) |

---

### 3. Volume Types

| Type                  | Category             | Max IOPS     | Max Throughput | Use Case                                       |
| --------------------- | -------------------- | ------------ | -------------- | ---------------------------------------------- |
| **gp3**               | General SSD          | 16,000 IOPS  | 1,000 MB/s     | Default; OS volumes, most workloads            |
| **gp2**               | General SSD (legacy) | 16,000 IOPS  | 250 MB/s       | Legacy; migrate to gp3                         |
| **io2 Block Express** | Provisioned IOPS SSD | 256,000 IOPS | 4,000 MB/s     | Mission-critical DBs (Oracle, SQL Server, SAP) |
| **io1**               | Provisioned IOPS SSD | 64,000 IOPS  | 1,000 MB/s     | High-performance DBs                           |
| **st1**               | Throughput HDD       | 500 IOPS     | 500 MB/s       | Big data, Kafka, log processing                |
| **sc1**               | Cold HDD             | 250 IOPS     | 250 MB/s       | Infrequently accessed, archival                |

**Rule of thumb**:

- OS disk + general workloads → **gp3**
- High-performance DB → **io2**
- Sequential large data (Kafka, ETL) → **st1**
- Can't use HDD as boot volume (only gp2/gp3/io1/io2)

---

### 4. EBS vs EFS vs S3

| Dimension       | EBS                      | EFS                         | S3                        |
| --------------- | ------------------------ | --------------------------- | ------------------------- |
| **Type**        | Block storage            | File storage (NFS)          | Object storage            |
| **Access**      | One EC2 at a time        | Multiple EC2 simultaneously | HTTPS / SDK               |
| **Protocol**    | Block device (ext4, xfs) | NFS                         | REST API                  |
| **Performance** | Highest (local-like)     | Good (NFS overhead)         | Lowest (API calls)        |
| **Scope**       | AZ-locked                | Multi-AZ (Regional)         | Global                    |
| **Use case**    | DB volumes, OS disks     | Shared file system          | Media, backups, data lake |

---

### 5. EBS Snapshots

```
SNAPSHOT BEHAVIOR:
  Snapshots are incremental:
    First snapshot: full copy of all data
    Subsequent snapshots: only changed blocks

  Stored in S3 (managed by AWS; you don't see them in your S3 buckets)
  Can copy across regions (for DR / AMI sharing)
  Can share with other AWS accounts

SNAPSHOT LIFECYCLE:
  Manual snapshot: create via Console/CLI/SDK
  Automated: Amazon Data Lifecycle Manager (DLM)
    Policy: snapshot daily at 2am, retain last 7 snapshots
    → Cross-region copy for DR

RESTORE PERFORMANCE:
  Newly restored volume from snapshot: lazy loading
  First access to each block triggers download from S3 → can be slow

  SOLUTION: Fast Snapshot Restore (FSR)
    Costs extra; pre-warms the volume for full performance immediately
  OR: Force-initialize before use:
    dd if=/dev/xvdf of=/dev/null bs=1M  ← reads all blocks, triggers download
```

---

## PART 2

---

### 6. When to Use EBS

✅ **Use EBS when**:

- EC2 OS root volume (required)
- Database storage where EC2 hosts the DB (MySQL, PostgreSQL on EC2)
- High-IOPS workloads (Oracle, SQL Server, SAP HANA)
- Low-latency block storage needed
- Data must persist independent of EC2 lifecycle

❌ **Don't use EBS when**:

- Shared file access across multiple EC2 → use **EFS**
- Object/file storage accessible from anywhere → use **S3**
- Managed database (no EC2) → use **RDS / Aurora** (they manage their own storage)
- Static assets, backups → **S3** is cheaper and more durable

---

### 7. EBS Performance Tuning

```
gp3 vs gp2 (ALWAYS choose gp3 for new volumes):
  gp2: IOPS tied to size (3 IOPS/GB; 100 min, 16,000 max)
        Cost: $0.10/GB/month
  gp3: IOPS independent of size (3,000 baseline free; up to 16,000 for extra cost)
        Cost: $0.08/GB/month (20% cheaper than gp2!)

  gp3 migration: zero-downtime resize via ModifyVolume API

IOPS MATH FOR INTERVIEW:
  Needing 10,000 IOPS with gp2:
    10,000 IOPS / 3 IOPS/GB = 3,334 GB volume required
    Cost: 3,334 GB × $0.10 = $333/month

  Same with gp3:
    100 GB volume + provisioned 10,000 IOPS
    Cost: 100 × $0.08 + 7,000 extra IOPS × $0.005 = $43/month
    Savings: ~87% ✅

EBS OPTIMIZED:
  Dedicated network bandwidth for EBS I/O (vs shared network)
  Most modern instance types are EBS-optimized by default
  Always enable EBS optimization for DB workloads
```

---

### 8. AWS Architecture Example

```
THREE-TIER WITH PERSISTENT STORAGE:
  [EC2: App Server]
    /dev/xvda → gp3 8GB (OS root volume)

  [EC2: Database Server (MySQL)]
    /dev/xvda → gp3 30GB (OS root)
    /dev/xvdf → io2 500GB (MySQL data directory)
      → 10,000 IOPS provisioned for DB workload
      → Multi-Attach disabled (single DB instance owns the disk)

  SNAPSHOT AUTOMATION:
    DLM Policy:
      Target: volumes with tag env=production
      Schedule: daily at 3am UTC
      Retain: 7 daily + 4 weekly
      Cross-region copy: us-west-2 (DR)

  ENCRYPTION:
    All volumes: SSE with KMS key (enforce via IAM/SCPs)
    Snapshots: encrypted automatically if source volume is encrypted

  RESIZE WITHOUT DOWNTIME:
    AWS Console → Modify Volume → increase size or change type
    Wait for modification to complete (~minutes)
    Linux: resize2fs (ext4) or xfs_growfs (xfs) — no restart needed
    Windows: Disk Management → Extend Volume
```

---

### 9. Interview-Ready Explanation (30 sec)

> _"EBS is high-performance block storage for EC2 — think of it as a persistent external SSD attached to a virtual machine. It stays around independently of the EC2 lifecycle, so you can stop/start the instance without losing data._
>
> _For most workloads I use gp3 — it's 20% cheaper than gp2 and IOPS are independent of volume size, so I don't pay for unnecessary storage to get the IOPS I need. For high-performance databases, io2 with provisioned IOPS. For shared access across multiple EC2 instances, I'd use EFS instead._
>
> _Backup strategy: automated snapshots via Data Lifecycle Manager with cross-region copies for disaster recovery."_

---

### 10. Common Interview Questions

**Q1: What happens to EBS data when an EC2 instance is terminated?**

> By default, the root EBS volume is deleted on termination (`DeleteOnTermination=true`). Any additional (non-root) EBS volumes persist after termination by default. Best practice: for root volumes that contain important data, set `DeleteOnTermination=false`. For production databases, store data on a separate non-root volume so it survives instance termination. Also consider that EBS volumes are AZ-locked — if you need data in another AZ, you must take a snapshot and restore it there.

**Q2: How does EBS differ from instance store?**

> Instance store is physically attached NVMe storage on the EC2 host hardware. Pros: extremely fast (millions of IOPS, very low latency). Cons: ephemeral — all data is lost when the instance stops, hibernates, or is terminated. Use case: temp data, buffers, caches, scratch space. EBS: network-attached, persists independently, survives stop/start/termination. Use case: everything permanent. Rule: instance store for Redis replicas (rebuild on restart anyway), shuffle sort space for EMR, swap space. EBS for anything you care about keeping.

**Q3: How do you migrate an EBS volume from us-east-1 to eu-west-1?**

> EBS volumes are AZ and region-locked — you can't directly move them. Process: (1) Create a snapshot of the EBS volume (in us-east-1). (2) Copy the snapshot to eu-west-1 (`aws ec2 copy-snapshot --destination-region eu-west-1`). (3) In eu-west-1: create a new EBS volume from the copied snapshot. (4) Attach the new volume to an EC2 instance in eu-west-1. The copy is point-in-time — for zero-downtime migration, stop writes to the volume before snapshotting, or accept some data lag.

---

> **Next Topic →** [05 · RDS](./05-rds.md)

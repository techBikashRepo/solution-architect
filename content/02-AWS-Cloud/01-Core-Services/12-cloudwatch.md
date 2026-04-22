# CloudWatch — AWS Observability Service

> **Subject**: AWS Cloud · **Group**: ☁️ Core Services · **Topic**: 12 of 12
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is it?

**Amazon CloudWatch** is AWS's native observability platform. It collects and tracks metrics, logs, and events across all AWS services and your applications. Use it to understand system health, set alarms, troubleshoot issues, and automate responses.

The three pillars CloudWatch covers:

| Pillar                  | CloudWatch Feature                  |
| ----------------------- | ----------------------------------- |
| **Metrics**             | CloudWatch Metrics + custom metrics |
| **Logs**                | CloudWatch Logs + Log Insights      |
| **Alarms + Automation** | Alarms → SNS, Auto Scaling, Lambda  |

---

### 2. Key Components

| Component                | What it does                                                                   |
| ------------------------ | ------------------------------------------------------------------------------ |
| **Metrics**              | Time-series data points (CPU%, request count, latency)                         |
| **Namespaces**           | Logical container for metrics (AWS/EC2, AWS/Lambda, Custom/MyApp)              |
| **Dimensions**           | Attribute filters for metrics (InstanceId, FunctionName, QueueUrl)             |
| **Alarms**               | Trigger action when metric crosses threshold                                   |
| **Log Groups**           | Logical container for log streams                                              |
| **Log Streams**          | Sequence of log events from one source (one EC2 instance, one Lambda function) |
| **Log Insights**         | SQL-like query language for log analysis                                       |
| **Dashboards**           | Visual panels combining metrics and alarms                                     |
| **Contributor Insights** | Identify top-N contributors to high-cardinality metrics                        |
| **Synthetics**           | Canary scripts that test endpoints on schedule                                 |
| **Evidently**            | Feature flags and A/B testing with CloudWatch metrics                          |

---

### 3. Metrics

```
METRIC RESOLUTION:
  Standard resolution: 1 minute (default, free for AWS services)
  High resolution: 1 second (custom metrics, extra cost)

KEY AWS METRICS TO KNOW:
  EC2:
    CPUUtilization, NetworkIn/Out, DiskReadOps/WriteOps
    (Memory: NOT collected by default — needs CloudWatch Agent)

  Lambda:
    Invocations, Duration, Errors, Throttles, ConcurrentExecutions
    (Custom: business metrics via custom namespace)

  ALB:
    RequestCount, TargetResponseTime, HTTPCode_ELB_5XX
    HealthyHostCount, UnHealthyHostCount

  RDS:
    CPUUtilization, DatabaseConnections, FreeStorageSpace
    ReadLatency, WriteLatency, ReadIOPS, WriteIOPS

  SQS:
    ApproximateNumberOfMessagesVisible (queue depth)
    NumberOfMessagesSent/Received, ApproximateAgeOfOldestMessage

CUSTOM METRICS (application code):
  aws cloudwatch put-metric-data \
    --namespace "MyApp/Orders" \
    --metric-name "OrdersProcessed" \
    --value 42 \
    --unit Count

  In code (SDK):
    cloudwatch.put_metric_data(
        Namespace='MyApp/Orders',
        MetricData=[{
            'MetricName': 'OrderProcessingTime',
            'Dimensions': [{'Name': 'Environment', 'Value': 'prod'}],
            'Value': 127.5,
            'Unit': 'Milliseconds'
        }]
    )
```

---

### 4. CloudWatch Alarms

```
ALARM STATES:
  OK: metric within threshold
  ALARM: metric breached threshold
  INSUFFICIENT_DATA: not enough data to evaluate

ALARM CONFIGURATION:
  Metric: Lambda/Errors
  Period: 60 seconds (evaluated every 1 min)
  Evaluation Periods: 3 (alarm if 3 consecutive periods breach)
  Threshold: >= 5 errors

  Action when ALARM:
    → SNS topic → PagerDuty (page on-call)
    → SNS topic → email notification
    → Auto Scaling: scale out EC2 ASG
    → Lambda invocation (auto-remediation)
    → EC2 action: reboot/recover/stop

COMPOSITE ALARMS:
  Combine multiple alarms with AND/OR logic
  ALARM if: (CPU > 80%) AND (Memory > 90%)
  Reduces alert noise: don't alert on CPU alone (could be normal spike)

ANOMALY DETECTION:
  CloudWatch learns the normal baseline (seasonality, trends)
  Set threshold as "N standard deviations from expected"
  Automatically adapts to traffic patterns (higher on weekdays, etc.)

MATH EXPRESSIONS IN ALARMS:
  Alarm on: error rate (errors/requests) instead of raw error count
  EXPRESSION: m1 / m2 * 100 > 1
  m1 = Lambda Errors, m2 = Lambda Invocations
  → Alert only if error RATE > 1%, not raw count (handles low-traffic)
```

---

### 5. CloudWatch Logs + Log Insights

```
LOG GROUPS AND RETENTION:
  /aws/lambda/my-function  → default: never expire (expensive!)
  Set retention: 7 days for dev, 30 days for prod, 90 days for compliance

  CloudWatch Logs → S3 export → Glacier (long-term cheap archival)

LOG INSIGHTS QUERIES:
  Find top errors in Lambda (last 1 hour):
    fields @timestamp, @message
    | filter @message like /ERROR/
    | sort @timestamp desc
    | limit 50

  P99 latency from ALB access logs:
    fields @timestamp, targetProcessingTime
    | stats pct(targetProcessingTime, 99) as p99 by bin(5m)

  Count errors by error type:
    fields @message
    | parse @message "ERROR: *" as errorMsg
    | stats count() by errorMsg
    | sort count desc

  Find slow Lambda invocations:
    filter @type = "REPORT"
    | fields @duration
    | stats avg(@duration), max(@duration), pct(@duration, 99) as p99
    | sort p99 desc

CLOUDWATCH AGENT (EC2):
  Collects: Memory, disk usage, custom app logs
  Config file: /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
  Required for memory metrics (not available without agent)
```

---

## PART 2

---

### 6. Observability Best Practices

```
THE FOUR GOLDEN SIGNALS (Google SRE):
  1. Latency: time to serve a request (p50, p95, p99 — not average!)
  2. Traffic: request rate (requests/sec, messages/sec)
  3. Errors: error rate (%)
  4. Saturation: resource utilization (CPU, memory, queue depth)

ALARM STRATEGY:
  Alert on symptoms, not causes:
    ✅ "User-facing error rate > 1%" — symptom
    ✅ "P99 latency > 3 seconds" — symptom
    ✅ "Healthy host count < 2" — imminent symptom
    ❌ "CPU > 80%" alone — cause (might be fine)
    ❌ "Disk at 70%" alone — cause (might be fine for months)

  Use composite alarms for precision: CPU > 80% AND memory > 85%

STRUCTURED LOGGING (best practice):
  Log JSON instead of plain text:
    {"level":"ERROR","service":"order-api","orderId":"123",
     "error":"DB timeout","duration":5003,"timestamp":"2024-01-15T10:30:00Z"}

  Benefits:
    Log Insights can query fields directly (no regex parsing)
    filter level = "ERROR" and service = "order-api" | stats count by error
```

---

### 7. CloudWatch vs X-Ray vs CloudTrail

| Service        | Purpose               | Use For                                         |
| -------------- | --------------------- | ----------------------------------------------- |
| **CloudWatch** | Metrics, logs, alarms | System health, alerts, dashboards               |
| **X-Ray**      | Distributed tracing   | End-to-end request tracing across microservices |
| **CloudTrail** | API audit log         | Who called what AWS API, when, from where       |

```
COMBINED OBSERVABILITY STORY:
  CloudWatch Alarm fires: "Lambda errors > 5%"
  → Check CloudWatch Logs: find ERROR log entries with traceId
  → X-Ray trace: see the full request path (which service failed, latency per hop)
  → CloudTrail: if suspicious (unexpected IAM calls), see who made the API call

X-RAY INTEGRATION:
  Lambda: enable Active Tracing in function config
  API Gateway: enable X-Ray tracing
  ECS: add X-Ray daemon sidecar container
  SDK: instrument with aws-xray-sdk (auto-patches HTTP clients, AWS SDK calls)
```

---

### 8. AWS Architecture Example

```
FULL OBSERVABILITY STACK:
─────────────────────────────────────────────────────────
  Application Layer:
    Lambda, ECS services → emit:
      Custom metrics (CloudWatch SDK)
      Structured JSON logs (CloudWatch Logs Agent or Lambda auto)
      X-Ray traces (SDK instrumentation)

  CloudWatch:
    Log Groups: /aws/lambda/* , /ecs/my-service
    Log retention: 30 days (Lambda dev: 7 days)

    Alarms:
      Lambda/Errors > 5/min for 3 periods → SNS → PagerDuty
      ALB TargetResponseTime p99 > 2s → SNS → Slack
      SQS ApproximateNumberOfMessagesVisible > 10000 → SNS → Slack
      RDS DatabaseConnections > 80% → SNS → email
      HealthyHostCount < 2 → SNS → PagerDuty (critical)

    Dashboards:
      "Production Health" dashboard:
        Widget: ALB request count + 5xx rate (last 3h)
        Widget: Lambda concurrent executions + errors
        Widget: RDS CPU + connections
        Widget: SQS queue depth per queue
        Widget: Custom: orders/min, revenue/hr

  Alerting:
    Critical (page now): P0 alarm → SNS → PagerDuty
    Warning (Slack): P1 alarm → SNS → Slack webhook
    Informational (email): P2 alarm → SNS → email DL

  Cost: CloudWatch costs ~$3/GB for logs + $0.30/metric/month custom metrics
        Set log retention! Unlimited logs → unbounded cost
```

---

### 9. Interview-Ready Explanation (30 sec)

> _"CloudWatch is AWS's observability service covering metrics, logs, and alarms. For production monitoring, I follow the Four Golden Signals: latency (p99, not average), traffic (requests/sec), error rate (%), and saturation (CPU, memory, queue depth)._
>
> _Key setup: Lambda and ECS emit structured JSON logs to CloudWatch Logs; I use Log Insights to query them with SQL. Alarms trigger on symptoms — user-facing error rate > 1%, p99 latency > 2s — not raw CPU. Use composite alarms to reduce noise._
>
> _CloudWatch covers metrics and logs; X-Ray covers distributed tracing; CloudTrail covers API audit. Together they give full observability."_

---

### 10. Common Interview Questions

**Q1: How would you set up alerting for a production Lambda function?**

> Four alarms minimum: (1) Error rate alarm: math expression `Errors/Invocations * 100 > 1`, 5-minute period, 3 evaluation periods → SNS → PagerDuty. (2) Throttles alarm: `Throttles > 0` for 5 consecutive minutes → SNS → Slack (scaling issue). (3) Duration p99 alarm: `Duration p99 > 80% of timeout` (if timeout is 30s, alarm if p99 > 24s) → SNS → Slack. (4) Concurrent executions alarm: `ConcurrentExecutions > 80% of account limit` → SNS → Slack. Plus: DLQ depth alarm if the function has a DLQ. Subscribe Lambda Insights (enhanced monitoring add-on) for memory utilization — not available in standard Lambda metrics. Set log group retention to 30 days in prod.

**Q2: What is the difference between CloudWatch Logs and CloudTrail?**

> CloudWatch Logs: captures application and service logs. What happened inside your application — errors, slow queries, business events. You push these logs (Lambda auto-sends; EC2 needs CloudWatch Agent). Used for debugging, dashboards, alerting on application behavior. CloudTrail: captures AWS API calls. What happened to your AWS infrastructure — who created an EC2 instance, who changed a security group, who called DeleteBucket. CloudTrail is enabled by default for 90 days (Event History); enable a Trail to S3 for long-term retention. Used for security auditing, compliance, incident investigation. Rule of thumb: CloudWatch Logs = application observability; CloudTrail = infrastructure security audit.

**Q3: Why should you use p99 latency in alarms instead of average latency?**

> Average latency hides tail latency problems. Example: 99 requests complete in 100ms, 1 request takes 10,000ms. Average = 199ms — looks fine. But 1% of users are waiting 10 seconds — a terrible experience. p99 (99th percentile) = 10,000ms — the alarm fires immediately. In practice: most users see good latency while a small percentage hit slow paths (cold starts, DB query without index, lock contention). Average masks these outliers completely. p99 or p95 exposes them. For SLOs: define "99% of requests complete within 500ms" — then alarm on p99 > 500ms. For very strict SLAs: track p99.9. Average latency is almost useless for production alerting — always use percentiles.

---

> ✅ **Core Services Complete (12/12)**
> **Next Group →** [AWS Architecture Mapping](../02-Architecture-Mapping/README.md)

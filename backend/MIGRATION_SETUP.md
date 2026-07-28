# Database Migration Setup for AWS ECS

This document explains how database migrations are handled in the Docker container for AWS ECS deployment.

## Overview

The backend Docker container automatically runs database migrations before starting the application server. This ensures that your database schema is always up-to-date when deploying new versions.

## How It Works

1. **Container Starts**: When the ECS task starts, the `docker-entrypoint.sh` script runs first
2. **Database Connection Check**: The script waits for the database to be ready (up to 60 seconds)
3. **Run Migrations**: Once connected, it runs `npm run migrate` to apply any pending migrations
4. **Start Application**: After migrations complete, the application server starts

## Files Involved

### 1. `docker-entrypoint.sh`
The entrypoint script that orchestrates the migration process:
- Waits for database connectivity
- Runs migrations
- Starts the application

### 2. `Dockerfile`
Updated to:
- Copy the entrypoint script
- Make it executable
- Set it as the container's ENTRYPOINT

### 3. `scripts/run-migration.ts`
The actual migration script that applies database changes.

## Environment Variables Required

Make sure these environment variables are set in your ECS Task Definition:

```bash
DATABASE_URL=postgresql://username:password@hostname:5432/database
```

## ECS Task Definition Configuration

### Health Check Settings
The container includes a health check that verifies the application is running:
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Start Period**: 40 seconds (allows time for migrations)
- **Retries**: 3

### Recommended Task Settings
```json
{
  "healthCheck": {
    "command": ["CMD-SHELL", "curl -f http://localhost:5000/health || exit 1"],
    "interval": 30,
    "timeout": 10,
    "startPeriod": 40,
    "retries": 3
  }
}
```

## Deployment Process

### Option 1: Automatic Migration (Recommended)
Migrations run automatically when the container starts. This is the default behavior.

**Pros:**
- Simple deployment process
- No manual intervention needed
- Works well for most migrations

**Cons:**
- Application downtime during migration
- Not suitable for long-running migrations

### Option 2: Separate Migration Task
For production environments with zero-downtime requirements:

1. Run migration as a separate ECS task before deployment
2. Deploy new application version after migration completes

```bash
# Run migration task
aws ecs run-task \
  --cluster your-cluster \
  --task-definition your-backend-task \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx]}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["npm","run","migrate"]}]}'

# Wait for migration to complete, then deploy new version
```

## Troubleshooting

### Migration Fails
If migrations fail, the container will exit with an error. Check CloudWatch logs:

```bash
aws logs tail /ecs/your-backend-task --follow
```

### Database Connection Issues
If the script can't connect to the database:
1. Verify DATABASE_URL is correct
2. Check security group rules allow ECS → RDS traffic
3. Ensure RDS is in the same VPC/subnet or properly configured
4. Verify RDS is not in a public subnet without proper routing

### Migration Takes Too Long
If migrations take longer than the health check start period:
1. Increase `startPeriod` in health check configuration
2. Consider running migrations as a separate task

## Rolling Back Migrations

If you need to roll back a migration:

1. **Revert Code**: Deploy the previous version of your application
2. **Manual Rollback**: Connect to the database and manually revert changes
3. **Migration Script**: Create a down migration script if needed

## Best Practices

1. **Test Migrations Locally**: Always test migrations in development first
2. **Backup Database**: Take a snapshot before running migrations in production
3. **Monitor Logs**: Watch CloudWatch logs during deployment
4. **Idempotent Migrations**: Ensure migrations can be run multiple times safely
5. **Small Changes**: Keep migrations small and incremental
6. **Zero-Downtime**: For critical systems, use separate migration tasks

## Security Considerations

1. **Database Credentials**: Store in AWS Secrets Manager or Parameter Store
2. **Network Security**: Ensure ECS and RDS are in private subnets
3. **IAM Roles**: Use task roles for accessing AWS services
4. **Encryption**: Enable encryption at rest and in transit for RDS

## Example ECS Task Definition

```json
{
  "family": "backend-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "your-ecr-repo/backend:latest",
      "portMappings": [
        {
          "containerPort": 5000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:db-url"
        }
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:5000/health || exit 1"],
        "interval": 30,
        "timeout": 10,
        "startPeriod": 40,
        "retries": 3
      },
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

## Monitoring

Monitor migration success/failure through:
1. **CloudWatch Logs**: Check container logs for migration output
2. **ECS Events**: Monitor task start/stop events
3. **Application Metrics**: Track application health after deployment
4. **Database Metrics**: Monitor RDS performance during migrations

## Support

For issues or questions:
1. Check CloudWatch logs first
2. Verify database connectivity
3. Review migration scripts for errors
4. Contact DevOps team if issues persist

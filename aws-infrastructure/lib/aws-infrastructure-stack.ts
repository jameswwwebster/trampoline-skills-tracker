import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class AwsInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ======================
    // VPC and Networking
    // ======================
    const vpc = new ec2.Vpc(this, 'TrampolineSkillsVPC', {
      maxAzs: 2, // Use 2 availability zones for high availability
      natGateways: 1, // Cost optimization - use 1 NAT gateway
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // ======================
    // S3 Bucket for File Storage
    // ======================
    const fileStorageBucket = new s3.Bucket(this, 'TrampolineSkillsStorage', {
      // Let CDK generate a unique bucket name automatically
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Keep data when stack is deleted
    });

    // ======================
    // Database (RDS PostgreSQL)
    // ======================
    const databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\',
      },
    });

    const database = new rds.DatabaseInstance(this, 'TrampolineSkillsDB', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_13,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      credentials: rds.Credentials.fromSecret(databaseSecret),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      databaseName: 'trampoline_skills',
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      deleteAutomatedBackups: false,
      backupRetention: cdk.Duration.days(7),
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ======================
    // ECS Cluster
    // ======================
    const cluster = new ecs.Cluster(this, 'TrampolineSkillsCluster', {
      vpc,
      clusterName: 'trampoline-skills-cluster',
      containerInsights: true,
    });

    // ======================
    // IAM Role for ECS Tasks
    // ======================
    const taskRole = new iam.Role(this, 'ECSTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Grant S3 access to the task role
    fileStorageBucket.grantReadWrite(taskRole);

    // Grant Secrets Manager access
    databaseSecret.grantRead(taskRole);

    // ======================
    // Application Load Balanced Fargate Service
    // ======================
    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'TrampolineSkillsService', {
      cluster,
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: 1,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('nginx:latest'), // Placeholder - will be replaced with your app
        containerPort: 5000,
        taskRole,
        environment: {
          NODE_ENV: 'production',
          STORAGE_TYPE: 's3',
          AWS_S3_BUCKET: fileStorageBucket.bucketName,
          AWS_REGION: this.region,
        },
        secrets: {
          DATABASE_URL: ecs.Secret.fromSecretsManager(databaseSecret, 'password'),
        },
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'trampoline-skills',
          logRetention: logs.RetentionDays.ONE_WEEK,
        }),
      },
      publicLoadBalancer: true,
      domainZone: undefined, // Add your domain zone here if you have one
      protocol: cdk.aws_elasticloadbalancingv2.ApplicationProtocol.HTTP,
    });

    // Allow ECS to connect to RDS
    database.connections.allowFrom(fargateService.service, ec2.Port.tcp(5432));

    // ======================
    // Auto Scaling
    // ======================
    const scaling = fargateService.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
    });

    // ======================
    // CloudWatch Alarms
    // ======================
    const highCpuAlarm = new cdk.aws_cloudwatch.Alarm(this, 'HighCpuAlarm', {
      metric: fargateService.service.metricCpuUtilization(),
      threshold: 80,
      evaluationPeriods: 2,
    });

    const highMemoryAlarm = new cdk.aws_cloudwatch.Alarm(this, 'HighMemoryAlarm', {
      metric: fargateService.service.metricMemoryUtilization(),
      threshold: 85,
      evaluationPeriods: 2,
    });

    // ======================
    // Outputs
    // ======================
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: fargateService.loadBalancer.loadBalancerDnsName,
      description: 'DNS name of the load balancer',
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.instanceEndpoint.hostname,
      description: 'RDS instance endpoint',
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: fileStorageBucket.bucketName,
      description: 'S3 bucket name for file storage',
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: databaseSecret.secretArn,
      description: 'ARN of the database secret',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      description: 'ECS cluster name',
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: fargateService.service.serviceName,
      description: 'ECS service name',
    });
  }
}

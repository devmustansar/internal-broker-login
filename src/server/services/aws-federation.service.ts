import { STSClient, AssumeRoleCommand, GetFederationTokenCommand } from "@aws-sdk/client-sts";
import type {
  AwsResourceConfig,
  AwsBrokerCredentials,
  AwsTemporaryCredentials,
  AwsFederationResult,
} from "@/types";

// ─── Managed-policy → inline-policy action mapping ────────────────────────────
//
// GetFederationToken does NOT properly scope AWS Console access via PolicyArns.
// AWS docs: managed PolicyArns through GetFederationToken are not supported for
// console federation sign-in (the restriction is ignored by the signin endpoint).
//
// Workaround: translate the assigned managed policy ARNs into an equivalent
// inline Policy JSON (Allow statements) so STS + the console honour the scope.
// Only the services declared here will be accessible in the federated session.

// const MANAGED_POLICY_INLINE_MAP: Record<string, { actions: string[]; resources: string }> = {
//   // Full access policies
//   "arn:aws:iam::aws:policy/AdministratorAccess":        { actions: ["*"],             resources: "*" },
//   "arn:aws:iam::aws:policy/PowerUserAccess":            { actions: ["*"],             resources: "*" },
//   // Read-only / view-only
//   "arn:aws:iam::aws:policy/ReadOnlyAccess":             { actions: ["*.Describe*", "*.List*", "*.Get*", "*.View*", "s3:GetObject"],  resources: "*" },
//   "arn:aws:iam::aws:policy/ViewOnlyAccess":             { actions: ["*.Describe*", "*.List*", "*.Get*"],  resources: "*" },
//   "arn:aws:iam::aws:policy/SecurityAudit":              { actions: ["*.Describe*", "*.List*", "*.Get*", "iam:*", "cloudtrail:*"],  resources: "*" },
//   // S3
//   "arn:aws:iam::aws:policy/AmazonS3FullAccess":         { actions: ["s3:*"],          resources: "*" },
//   "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess":     { actions: ["s3:Get*", "s3:List*"],  resources: "*" },
//   // EC2
//   "arn:aws:iam::aws:policy/AmazonEC2FullAccess":        { actions: ["ec2:*", "elasticloadbalancing:*", "cloudwatch:*", "autoscaling:*"],  resources: "*" },
//   "arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess":    { actions: ["ec2:Describe*", "elasticloadbalancing:Describe*", "cloudwatch:Describe*", "autoscaling:Describe*"],  resources: "*" },
//   // RDS
//   "arn:aws:iam::aws:policy/AmazonRDSFullAccess":        { actions: ["rds:*", "ec2:*", "cloudwatch:*"],  resources: "*" },
//   // Lambda
//   "arn:aws:iam::aws:policy/AWSLambda_FullAccess":       { actions: ["lambda:*", "iam:PassRole"],  resources: "*" },
//   // DynamoDB
//   "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess":   { actions: ["dynamodb:*", "cloudwatch:*"],  resources: "*" },
//   // Job function policies
//   "arn:aws:iam::aws:policy/job-function/Billing":                  { actions: ["aws-portal:*", "budgets:*", "ce:*", "cur:*"],  resources: "*" },
//   "arn:aws:iam::aws:policy/job-function/DatabaseAdministrator":    { actions: ["rds:*", "dynamodb:*", "elasticache:*", "redshift:*", "cloudwatch:*"],  resources: "*" },
//   "arn:aws:iam::aws:policy/job-function/DataScientistAccess":      { actions: ["s3:*", "athena:*", "glue:*", "sagemaker:*", "redshift:*"],  resources: "*" },
//   "arn:aws:iam::aws:policy/job-function/NetworkAdministrator":     { actions: ["ec2:*", "elasticloadbalancing:*", "route53:*", "vpc:*"],  resources: "*" },
//   "arn:aws:iam::aws:policy/job-function/SupportUser":              { actions: ["support:*", "*.Describe*", "*.List*"],  resources: "*" },
//   "arn:aws:iam::aws:policy/job-function/SystemAdministrator":      { actions: ["*"],  resources: "*" },
//   // SSO / service-linked
//   "arn:aws:iam::aws:policy/aws-service-role/AWSSSOMemberAccountAdministrator": { actions: ["sso:*", "organizations:*"],  resources: "*" },
//   "arn:aws:iam::aws:policy/aws-service-role/AWSSSODirectoryAdministrator":     { actions: ["sso:*", "identitystore:*"],  resources: "*" },
//   "arn:aws:iam::aws:policy/aws-service-role/AWSSSOReadOnly":                   { actions: ["sso:List*", "sso:Get*", "identitystore:Describe*", "identitystore:List*"],  resources: "*" },
// };

const MANAGED_POLICY_INLINE_MAP: Record<string, { actions: string[]; resources: string }> = {
  // Full access policies
  "arn:aws:iam::aws:policy/AdministratorAccess": {
    actions: ["*"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/PowerUserAccess": {
    actions: [
      "*",
      "iam:PassRole",
    ],
    resources: "*",
  },

  // Read-only / view-only
  "arn:aws:iam::aws:policy/ReadOnlyAccess": {
    actions: [
      "*.Describe*",
      "*.List*",
      "*.Get*",
      "*.View*",
      "s3:GetObject",
      "s3:ListBucket",
    ],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/ViewOnlyAccess": {
    actions: [
      "*.Describe*",
      "*.List*",
      "*.Get*",
      "*.View*",
    ],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/SecurityAudit": {
    actions: [
      "*.Describe*",
      "*.List*",
      "*.Get*",
      "iam:Get*",
      "iam:List*",
      "cloudtrail:Get*",
      "cloudtrail:List*",
      "cloudtrail:Describe*",
      "config:Get*",
      "config:List*",
      "config:Describe*",
      "guardduty:Get*",
      "guardduty:List*",
      "securityhub:Get*",
      "securityhub:List*",
      "inspector2:Get*",
      "inspector2:List*",
    ],
    resources: "*",
  },

  // IAM
  "arn:aws:iam::aws:policy/IAMFullAccess": {
    actions: ["iam:*"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/IAMReadOnlyAccess": {
    actions: ["iam:Get*", "iam:List*", "iam:GenerateCredentialReport", "iam:GenerateServiceLastAccessedDetails"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/IAMUserChangePassword": {
    actions: ["iam:ChangePassword", "iam:GetAccountPasswordPolicy"],
    resources: "*",
  },

  // S3
  "arn:aws:iam::aws:policy/AmazonS3FullAccess": {
    actions: ["s3:*", "s3-object-lambda:*"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess": {
    actions: ["s3:Get*", "s3:List*", "s3-object-lambda:Get*", "s3-object-lambda:List*"],
    resources: "*",
  },

  // EC2 / VPC / NAT / Security Groups / EBS
  "arn:aws:iam::aws:policy/AmazonEC2FullAccess": {
    actions: [
      "ec2:*",
      "elasticloadbalancing:*",
      "cloudwatch:*",
      "autoscaling:*",
      "iam:CreateServiceLinkedRole",
    ],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess": {
    actions: [
      "ec2:Describe*",
      "elasticloadbalancing:Describe*",
      "cloudwatch:Describe*",
      "cloudwatch:Get*",
      "cloudwatch:List*",
      "autoscaling:Describe*",
    ],
    resources: "*",
  },

  // NAT is covered by EC2 actions, but you can add your own internal pseudo-policy
  "custom:aws:policy/NATGatewayFullAccess": {
    actions: [
      "ec2:CreateNatGateway",
      "ec2:DeleteNatGateway",
      "ec2:DescribeNatGateways",
      "ec2:CreateRoute",
      "ec2:ReplaceRoute",
      "ec2:DeleteRoute",
      "ec2:DescribeRouteTables",
      "ec2:DescribeSubnets",
      "ec2:DescribeVpcs",
      "ec2:DescribeAddresses",
      "ec2:AllocateAddress",
      "ec2:ReleaseAddress",
      "ec2:AssociateAddress",
      "ec2:DisassociateAddress",
      "ec2:CreateTags",
      "ec2:DeleteTags",
    ],
    resources: "*",
  },

  // VPC / Network
  "custom:aws:policy/VPCFullAccess": {
    actions: [
      "ec2:*Vpc*",
      "ec2:*Subnet*",
      "ec2:*Route*",
      "ec2:*InternetGateway*",
      "ec2:*NatGateway*",
      "ec2:*SecurityGroup*",
      "ec2:*NetworkAcl*",
      "ec2:*NetworkInterface*",
      "ec2:*Address*",
      "ec2:Describe*",
      "ec2:CreateTags",
      "ec2:DeleteTags",
    ],
    resources: "*",
  },

  // Elastic Load Balancing
  "arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess": {
    actions: [
      "elasticloadbalancing:*",
      "ec2:Describe*",
      "cloudwatch:*",
      "iam:CreateServiceLinkedRole",
    ],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/ElasticLoadBalancingReadOnly": {
    actions: [
      "elasticloadbalancing:Describe*",
      "ec2:Describe*",
      "cloudwatch:Get*",
      "cloudwatch:List*",
      "cloudwatch:Describe*",
    ],
    resources: "*",
  },

  // Auto Scaling
  "arn:aws:iam::aws:policy/AutoScalingFullAccess": {
    actions: ["autoscaling:*", "cloudwatch:*", "ec2:Describe*", "iam:CreateServiceLinkedRole"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AutoScalingReadOnlyAccess": {
    actions: ["autoscaling:Describe*", "cloudwatch:Get*", "cloudwatch:List*", "ec2:Describe*"],
    resources: "*",
  },

  // EKS
  "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy": {
    actions: [
      "ec2:CreateNetworkInterface",
      "ec2:DescribeInstances",
      "ec2:DescribeNetworkInterfaces",
      "ec2:DeleteNetworkInterface",
      "ec2:DescribeSubnets",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeRouteTables",
      "ec2:DescribeDhcpOptions",
      "ec2:DescribeVpcs",
      "ec2:CreateTags",
      "eks:*",
    ],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy": {
    actions: [
      "ec2:DescribeInstances",
      "ec2:DescribeInstanceTypes",
      "ec2:DescribeRouteTables",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeSubnets",
      "ec2:DescribeVolumes",
      "ec2:DescribeVolumesModifications",
      "ec2:DescribeVpcs",
      "eks:DescribeCluster",
    ],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy": {
    actions: [
      "ec2:AssignPrivateIpAddresses",
      "ec2:AttachNetworkInterface",
      "ec2:CreateNetworkInterface",
      "ec2:DeleteNetworkInterface",
      "ec2:DescribeInstances",
      "ec2:DescribeTags",
      "ec2:DescribeNetworkInterfaces",
      "ec2:DescribeInstanceTypes",
      "ec2:DetachNetworkInterface",
      "ec2:ModifyNetworkInterfaceAttribute",
      "ec2:UnassignPrivateIpAddresses",
      "ec2:CreateTags",
    ],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonEKSServicePolicy": {
    actions: ["eks:*", "ec2:Describe*", "iam:CreateServiceLinkedRole"],
    resources: "*",
  },

  // ECS / ECR
  "arn:aws:iam::aws:policy/AmazonECS_FullAccess": {
    actions: [
      "ecs:*",
      "ecr:*",
      "ec2:Describe*",
      "elasticloadbalancing:*",
      "cloudwatch:*",
      "logs:*",
      "application-autoscaling:*",
      "iam:PassRole",
      "iam:CreateServiceLinkedRole",
    ],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess": {
    actions: ["ecr:*"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly": {
    actions: ["ecr:Get*", "ecr:Describe*", "ecr:List*"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser": {
    actions: [
      "ecr:Get*",
      "ecr:Describe*",
      "ecr:List*",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:BatchCheckLayerAvailability",
    ],
    resources: "*",
  },

  // RDS / Aurora
  "arn:aws:iam::aws:policy/AmazonRDSFullAccess": {
    actions: [
      "rds:*",
      "application-autoscaling:DeleteScalingPolicy",
      "application-autoscaling:DeregisterScalableTarget",
      "application-autoscaling:DescribeScalableTargets",
      "application-autoscaling:DescribeScalingActivities",
      "application-autoscaling:DescribeScalingPolicies",
      "application-autoscaling:PutScalingPolicy",
      "application-autoscaling:RegisterScalableTarget",
      "cloudwatch:DescribeAlarms",
      "cloudwatch:GetMetricStatistics",
      "cloudwatch:PutMetricAlarm",
      "cloudwatch:DeleteAlarms",
      "ec2:Describe*",
      "sns:ListSubscriptions",
      "sns:ListTopics",
      "sns:Publish",
      "logs:DescribeLogStreams",
      "logs:GetLogEvents",
      "iam:CreateServiceLinkedRole",
    ],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonRDSReadOnlyAccess": {
    actions: [
      "rds:Describe*",
      "rds:ListTagsForResource",
      "ec2:Describe*",
      "cloudwatch:GetMetricStatistics",
      "cloudwatch:DescribeAlarms",
      "logs:DescribeLogStreams",
      "logs:GetLogEvents",
    ],
    resources: "*",
  },

  // Lambda
  "arn:aws:iam::aws:policy/AWSLambda_FullAccess": {
    actions: [
      "lambda:*",
      "cloudwatch:*",
      "logs:*",
      "iam:PassRole",
      "iam:CreateServiceLinkedRole",
    ],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AWSLambda_ReadOnlyAccess": {
    actions: [
      "lambda:Get*",
      "lambda:List*",
      "cloudwatch:GetMetricStatistics",
      "cloudwatch:ListMetrics",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
      "logs:GetLogEvents",
    ],
    resources: "*",
  },

  // DynamoDB
  "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess": {
    actions: [
      "dynamodb:*",
      "dax:*",
      "application-autoscaling:*",
      "cloudwatch:*",
      "iam:CreateServiceLinkedRole",
    ],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonDynamoDBReadOnlyAccess": {
    actions: [
      "dynamodb:Describe*",
      "dynamodb:List*",
      "dynamodb:GetItem",
      "dynamodb:BatchGetItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "cloudwatch:GetMetricStatistics",
    ],
    resources: "*",
  },

  // CloudWatch / Logs
  "arn:aws:iam::aws:policy/CloudWatchFullAccess": {
    actions: ["cloudwatch:*", "logs:*", "events:*", "sns:*"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/CloudWatchReadOnlyAccess": {
    actions: [
      "cloudwatch:Describe*",
      "cloudwatch:Get*",
      "cloudwatch:List*",
      "logs:Describe*",
      "logs:Get*",
      "logs:List*",
      "events:Describe*",
      "events:List*",
      "events:TestEventPattern",
    ],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess": {
    actions: ["logs:*", "cloudwatch:GenerateQuery"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/CloudWatchLogsReadOnlyAccess": {
    actions: ["logs:Describe*", "logs:Get*", "logs:List*", "logs:FilterLogEvents", "logs:StartQuery", "logs:StopQuery"],
    resources: "*",
  },

  // CloudTrail
  "arn:aws:iam::aws:policy/AWSCloudTrail_FullAccess": {
    actions: ["cloudtrail:*", "s3:*", "sns:*", "logs:*", "cloudwatch:*", "iam:CreateServiceLinkedRole"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AWSCloudTrail_ReadOnlyAccess": {
    actions: ["cloudtrail:Get*", "cloudtrail:List*", "cloudtrail:Describe*", "cloudtrail:LookupEvents"],
    resources: "*",
  },

  // Route53
  "arn:aws:iam::aws:policy/AmazonRoute53FullAccess": {
    actions: [
      "route53:*",
      "route53domains:*",
      "cloudfront:ListDistributions",
      "elasticloadbalancing:DescribeLoadBalancers",
      "elasticbeanstalk:DescribeEnvironments",
      "s3:ListBucket",
      "s3:GetBucketLocation",
      "s3:GetBucketWebsite",
      "ec2:DescribeVpcs",
      "ec2:DescribeVpcEndpoints",
      "ec2:DescribeRegions",
    ],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonRoute53ReadOnlyAccess": {
    actions: [
      "route53:Get*",
      "route53:List*",
      "route53:TestDNSAnswer",
      "route53domains:Get*",
      "route53domains:List*",
    ],
    resources: "*",
  },

  // CloudFront
  "arn:aws:iam::aws:policy/CloudFrontFullAccess": {
    actions: ["cloudfront:*", "acm:ListCertificates", "iam:ListServerCertificates", "waf:ListWebACLs", "wafv2:ListWebACLs"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/CloudFrontReadOnlyAccess": {
    actions: ["cloudfront:Get*", "cloudfront:List*"],
    resources: "*",
  },

  // API Gateway
  "arn:aws:iam::aws:policy/AmazonAPIGatewayAdministrator": {
    actions: ["apigateway:*"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonAPIGatewayInvokeFullAccess": {
    actions: ["execute-api:Invoke", "execute-api:ManageConnections"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonAPIGatewayPushToCloudWatchLogs": {
    actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:DescribeLogGroups", "logs:DescribeLogStreams", "logs:PutLogEvents", "logs:GetLogEvents", "logs:FilterLogEvents"],
    resources: "*",
  },

  // SQS / SNS
  "arn:aws:iam::aws:policy/AmazonSQSFullAccess": {
    actions: ["sqs:*"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonSQSReadOnlyAccess": {
    actions: ["sqs:Get*", "sqs:List*"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonSNSFullAccess": {
    actions: ["sns:*"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonSNSReadOnlyAccess": {
    actions: ["sns:Get*", "sns:List*", "sns:CheckIfPhoneNumberIsOptedOut"],
    resources: "*",
  },

  // SSM / Secrets Manager / KMS
  "arn:aws:iam::aws:policy/AmazonSSMFullAccess": {
    actions: ["ssm:*", "ssmmessages:*", "ec2messages:*", "cloudwatch:*", "iam:PassRole"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess": {
    actions: ["ssm:Get*", "ssm:List*", "ssm:Describe*", "ssm:GetParametersByPath"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/SecretsManagerReadWrite": {
    actions: ["secretsmanager:*", "cloudformation:CreateChangeSet", "cloudformation:DescribeChangeSet", "cloudformation:DescribeStackResource", "cloudformation:DescribeStacks", "cloudformation:ExecuteChangeSet", "docdb-elastic:GetCluster", "docdb-elastic:ListClusters", "ec2:DescribeSecurityGroups", "ec2:DescribeSubnets", "ec2:DescribeVpcs", "kms:DescribeKey", "kms:ListAliases", "kms:ListKeys", "lambda:ListFunctions", "rds:DescribeDBClusters", "rds:DescribeDBInstances", "redshift:DescribeClusters", "redshift-serverless:ListWorkgroups", "redshift-serverless:GetNamespace", "tag:GetResources"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AWSKeyManagementServicePowerUser": {
    actions: [
      "kms:Create*",
      "kms:Describe*",
      "kms:Enable*",
      "kms:List*",
      "kms:Put*",
      "kms:Update*",
      "kms:Revoke*",
      "kms:Disable*",
      "kms:Get*",
      "kms:Delete*",
      "kms:TagResource",
      "kms:UntagResource",
      "kms:ScheduleKeyDeletion",
      "kms:CancelKeyDeletion",
    ],
    resources: "*",
  },

  // ACM
  "arn:aws:iam::aws:policy/AWSCertificateManagerFullAccess": {
    actions: ["acm:*"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AWSCertificateManagerReadOnly": {
    actions: ["acm:DescribeCertificate", "acm:GetCertificate", "acm:ListCertificates", "acm:ListTagsForCertificate"],
    resources: "*",
  },

  // CloudFormation
  "arn:aws:iam::aws:policy/AWSCloudFormationFullAccess": {
    actions: ["cloudformation:*"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AWSCloudFormationReadOnlyAccess": {
    actions: ["cloudformation:Describe*", "cloudformation:Get*", "cloudformation:List*", "cloudformation:EstimateTemplateCost", "cloudformation:ValidateTemplate"],
    resources: "*",
  },

  // Elastic Beanstalk
  "arn:aws:iam::aws:policy/AWSElasticBeanstalkFullAccess": {
    actions: [
      "elasticbeanstalk:*",
      "ec2:*",
      "ecs:*",
      "ecr:*",
      "elasticloadbalancing:*",
      "autoscaling:*",
      "cloudwatch:*",
      "s3:*",
      "sns:*",
      "cloudformation:*",
      "iam:PassRole",
      "iam:CreateServiceLinkedRole",
    ],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AWSElasticBeanstalkReadOnly": {
    actions: [
      "elasticbeanstalk:Describe*",
      "elasticbeanstalk:List*",
      "elasticbeanstalk:RequestEnvironmentInfo",
      "elasticbeanstalk:RetrieveEnvironmentInfo",
    ],
    resources: "*",
  },

  // ElastiCache
  "arn:aws:iam::aws:policy/AmazonElastiCacheFullAccess": {
    actions: ["elasticache:*", "ec2:Describe*", "cloudwatch:*", "iam:CreateServiceLinkedRole"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonElastiCacheReadOnlyAccess": {
    actions: ["elasticache:Describe*", "elasticache:List*", "cloudwatch:GetMetricStatistics"],
    resources: "*",
  },

  // Redshift
  "arn:aws:iam::aws:policy/AmazonRedshiftFullAccess": {
    actions: ["redshift:*", "redshift-serverless:*", "ec2:Describe*", "cloudwatch:*", "iam:PassRole", "iam:CreateServiceLinkedRole"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonRedshiftReadOnlyAccess": {
    actions: ["redshift:Describe*", "redshift:View*", "redshift-serverless:Get*", "redshift-serverless:List*", "ec2:Describe*", "cloudwatch:GetMetricStatistics"],
    resources: "*",
  },

  // Glue / Athena
  "arn:aws:iam::aws:policy/AWSGlueConsoleFullAccess": {
    actions: ["glue:*", "s3:*", "cloudwatch:*", "logs:*", "iam:PassRole"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonAthenaFullAccess": {
    actions: ["athena:*", "glue:*", "s3:*"],
    resources: "*",
  },

  // SageMaker
  "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess": {
    actions: ["sagemaker:*", "ecr:*", "cloudwatch:*", "logs:*", "s3:*", "iam:PassRole"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonSageMakerReadOnly": {
    actions: ["sagemaker:Describe*", "sagemaker:List*", "sagemaker:Get*", "cloudwatch:GetMetricData", "cloudwatch:GetMetricStatistics", "logs:Describe*", "logs:Get*"],
    resources: "*",
  },

  // Cognito
  "arn:aws:iam::aws:policy/AmazonCognitoPowerUser": {
    actions: ["cognito-idp:*", "cognito-identity:*", "cognito-sync:*", "iam:ListRoles", "iam:PassRole", "sns:ListPlatformApplications"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonCognitoReadOnly": {
    actions: ["cognito-idp:Describe*", "cognito-idp:List*", "cognito-identity:Describe*", "cognito-identity:List*", "cognito-sync:Describe*", "cognito-sync:List*"],
    resources: "*",
  },

  // SES
  "arn:aws:iam::aws:policy/AmazonSESFullAccess": {
    actions: ["ses:*"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AmazonSESReadOnlyAccess": {
    actions: ["ses:Get*", "ses:List*", "ses:Describe*"],
    resources: "*",
  },

  // Organizations
  "arn:aws:iam::aws:policy/AWSOrganizationsFullAccess": {
    actions: ["organizations:*"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/AWSOrganizationsReadOnlyAccess": {
    actions: ["organizations:Describe*", "organizations:List*"],
    resources: "*",
  },

  // Job function policies
  "arn:aws:iam::aws:policy/job-function/Billing": {
    actions: ["aws-portal:*", "budgets:*", "ce:*", "cur:*", "pricing:*", "account:*"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/job-function/DatabaseAdministrator": {
    actions: [
      "rds:*",
      "dynamodb:*",
      "elasticache:*",
      "redshift:*",
      "redshift-serverless:*",
      "cloudwatch:*",
      "logs:*",
      "ec2:Describe*",
      "iam:PassRole",
    ],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/job-function/DataScientistAccess": {
    actions: [
      "s3:*",
      "athena:*",
      "glue:*",
      "sagemaker:*",
      "redshift:*",
      "redshift-serverless:*",
      "emr:*",
      "cloudwatch:*",
      "logs:*",
      "iam:PassRole",
    ],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/job-function/NetworkAdministrator": {
    actions: [
      "ec2:*",
      "elasticloadbalancing:*",
      "route53:*",
      "directconnect:*",
      "globalaccelerator:*",
      "networkmanager:*",
      "cloudfront:*",
      "acm:ListCertificates",
      "iam:CreateServiceLinkedRole",
    ],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/job-function/SupportUser": {
    actions: ["support:*", "*.Describe*", "*.List*", "*.Get*"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/job-function/SystemAdministrator": {
    actions: ["*"],
    resources: "*",
  },

  // SSO / service-linked
  "arn:aws:iam::aws:policy/aws-service-role/AWSSSOMemberAccountAdministrator": {
    actions: ["sso:*", "organizations:*"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/aws-service-role/AWSSSODirectoryAdministrator": {
    actions: ["sso:*", "identitystore:*"],
    resources: "*",
  },

  "arn:aws:iam::aws:policy/aws-service-role/AWSSSOReadOnly": {
    actions: ["sso:List*", "sso:Get*", "identitystore:Describe*", "identitystore:List*"],
    resources: "*",
  },
};

/**
 * Converts a list of managed policy ARNs to a single inline IAM policy JSON.
 * Needed because GetFederationToken's PolicyArns don't restrict console federation.
 */
function buildInlinePolicyFromArns(policyArns: string[]): string {
  const statements: object[] = [];

  // Collect all action sets from the mapped ARNs
  const actionSets: string[][] = [];
  for (const arn of policyArns) {
    const mapped = MANAGED_POLICY_INLINE_MAP[arn];
    if (mapped) {
      actionSets.push(mapped.actions);
    } else {
      // Unknown ARN — assume it's a custom policy; log and allow all as fallback
      console.warn(`[aws-federation] Unknown policy ARN in inline map, defaulting to allow-all: ${arn}`);
      actionSets.push(["*"]);
    }
  }

  // Check if any policy is allow-all
  const isAllowAll = actionSets.some((a) => a.includes("*"));
  const mergedActions = isAllowAll ? ["*"] : [...new Set(actionSets.flat())];

  statements.push({
    Effect: "Allow",
    Action: mergedActions,
    Resource: "*",
  });

  return JSON.stringify({ Version: "2012-10-17", Statement: statements });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AWS_FEDERATION_ENDPOINT = "https://signin.aws.amazon.com/federation";
const AWS_CONSOLE_BASE = "https://console.aws.amazon.com/";

/**
 * Allowlist of URL prefixes that are valid AWS Console destinations.
 * Any destination stored in the DB is validated against this list before
 * generating a redirect URL, preventing open-redirect attacks.
 *
 * Extend this list carefully — never allow arbitrary user-supplied URLs.
 */
const ALLOWED_DESTINATION_PREFIXES = [
  "https://console.aws.amazon.com/",
  "https://us-east-1.console.aws.amazon.com/",
  "https://us-east-2.console.aws.amazon.com/",
  "https://us-west-1.console.aws.amazon.com/",
  "https://us-west-2.console.aws.amazon.com/",
  "https://eu-west-1.console.aws.amazon.com/",
  "https://eu-central-1.console.aws.amazon.com/",
  "https://ap-southeast-1.console.aws.amazon.com/",
  "https://ap-northeast-1.console.aws.amazon.com/",
];

// Minimum/maximum STS session duration enforced by AWS
const STS_MIN_DURATION_SECONDS = 900;   // 15 minutes
const STS_MAX_DURATION_SECONDS = 43200; // 12 hours

// ─── AWS Federation Service ───────────────────────────────────────────────────

export const awsFederationService = {
  /**
   * Full federation flow: STS credentials → SigninToken → console login URL.
   *
   * @param config     - Resource configuration (roleArn, destination, etc.)
   * @param brokerCreds - Broker IAM credentials loaded from SecretsProvider
   * @param sessionName - Unique name for the STS session (include userId for CloudTrail)
   * @returns          - Login URL and metadata for the response
   */
  async generateConsoleLoginUrl(
    config: AwsResourceConfig,
    brokerCreds: AwsBrokerCredentials,
    sessionName: string
  ): Promise<AwsFederationResult> {
    // 1. Validate destination URL against allowlist
    validateDestination(config.destination);

    // 2. Validate session duration
    const durationSeconds = clampDuration(config.sessionDurationSeconds);

    // 3. Obtain temporary credentials from STS
    const tmpCreds =
      config.stsStrategy === "federation_token"
        ? await getFederationTokenCredentials(brokerCreds, sessionName, durationSeconds, config.policyArns)
        : await assumeRoleCredentials(brokerCreds, config, sessionName, durationSeconds);

    // 4. Request SigninToken from AWS federation endpoint
    const signinToken = await getSigninToken(tmpCreds, durationSeconds);

    // 5. Build final console login URL
    const loginUrl = buildLoginUrl(signinToken, config);

    return {
      loginUrl,
      expiresAt: tmpCreds.expiration.toISOString(),
      awsAccountId: config.awsAccountId,
      roleArn: config.roleArn,
    };
  },
};

// ─── STS: AssumeRole (preferred) ─────────────────────────────────────────────
//
// Use when: the broker IAM user has sts:AssumeRole permission and the target
// role's trust policy lists the broker IAM user as a principal.
// This is the recommended approach because it produces scoped, short-lived
// credentials that are tied to a specific role and auditable in CloudTrail.

async function assumeRoleCredentials(
  brokerCreds: AwsBrokerCredentials,
  config: AwsResourceConfig,
  sessionName: string,
  durationSeconds: number
): Promise<AwsTemporaryCredentials> {
  const sts = buildStsClient(brokerCreds, config.region);

  const cmd = new AssumeRoleCommand({
    RoleArn: config.roleArn,
    RoleSessionName: sanitizeSessionName(sessionName),
    DurationSeconds: durationSeconds,
    // ExternalId is required when the target role's trust policy uses a Condition: StringEquals sts:ExternalId
    ...(config.externalId ? { ExternalId: config.externalId } : {}),
    // Session policies scope down the assumed role's permissions per-user
    ...(config.policyArns && config.policyArns.length > 0
      ? { PolicyArns: config.policyArns.map((arn) => ({ arn })) }
      : {}),
  });

  let result;
  try {
    result = await sts.send(cmd);
  } catch (err) {
    // Do NOT log the error message directly — it may contain ARN details
    throw new AwsStsError(
      `STS AssumeRole failed for role '${config.roleArn}' in account '${config.awsAccountId}'`,
      err
    );
  }

  const creds = result.Credentials;
  if (!creds?.AccessKeyId || !creds.SecretAccessKey || !creds.SessionToken) {
    throw new AwsStsError("STS AssumeRole returned incomplete credentials");
  }

  return {
    sessionId: creds.AccessKeyId,
    sessionKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken,
    expiration: creds.Expiration ?? new Date(Date.now() + durationSeconds * 1000),
  };
}

// ─── STS: GetFederationToken (fallback) ───────────────────────────────────────
//
// Use when: AssumeRole is not available (e.g. broker uses root credentials — avoid
// this in production). The broker credentials ARE the credentials used to call
// the federation endpoint directly.
// NOTE: GetFederationToken does not support MFA and cannot be assumed cross-account.
// Prefer AssumeRole wherever possible.

async function getFederationTokenCredentials(
  brokerCreds: AwsBrokerCredentials,
  federatedUserName: string,
  durationSeconds: number,
  policyArns?: string[]
): Promise<AwsTemporaryCredentials> {
  // GetFederationToken is a global endpoint — region param is ignored by STS
  const sts = buildStsClient(brokerCreds, "us-east-1");

  const hasExplicitPolicies = policyArns && policyArns.length > 0;

  // IMPORTANT — why we use inline Policy, NOT PolicyArns here:
  //
  // AWS GetFederationToken's `PolicyArns` parameter does NOT reliably restrict
  // console federation sign-in sessions. The AWS federation signin endpoint at
  // signin.aws.amazon.com/federation honours the inline `Policy` JSON, but 
  // the `PolicyArns` session-policy restriction is silently ignored during
  // console token exchange for browser-based sessions.
  //
  // Fix: translate the assigned managed policy ARNs into an equivalent inline
  // IAM policy document (Allow statements with the relevant IAM actions).
  // This is the only reliable way to scope GetFederationToken console sessions.

  let inlinePolicy: string;
  if (hasExplicitPolicies) {
    inlinePolicy = buildInlinePolicyFromArns(policyArns!);
    console.log(
      `[aws-federation] GetFederationToken: scoping session with inline policy derived from ${policyArns!.length} ARN(s):`,
      policyArns
    );
    console.log("[aws-federation] Inline policy JSON:", inlinePolicy);
  } else {
    // No per-user policies → broker user's full effective permissions
    inlinePolicy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [{ Effect: "Allow", Action: "*", Resource: "*" }],
    });
    console.log("[aws-federation] GetFederationToken: no per-user policies, using allow-all fallback");
  }

  const cmd = new GetFederationTokenCommand({
    Name: sanitizeSessionName(federatedUserName),
    DurationSeconds: durationSeconds,
    Policy: inlinePolicy,
    // NOTE: PolicyArns intentionally NOT sent — unreliable for console federation.
    // Per-user scoping is handled via the inline Policy above.
  });

  let result;
  try {
    result = await sts.send(cmd);
  } catch (err) {
    console.error("[aws-federation] GetFederationToken failed:", err);
    throw new AwsStsError("STS GetFederationToken failed", err);
  }

  const creds = result.Credentials;
  if (!creds?.AccessKeyId || !creds.SecretAccessKey || !creds.SessionToken) {
    throw new AwsStsError("STS GetFederationToken returned incomplete credentials");
  }

  return {
    sessionId: creds.AccessKeyId,
    sessionKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken,
    expiration: creds.Expiration ?? new Date(Date.now() + durationSeconds * 1000),
  };
}


// ─── AWS SigninToken ──────────────────────────────────────────────────────────

/**
 * Exchanges temporary STS credentials for an AWS SigninToken via the
 * AWS federation endpoint. The SigninToken is a short-lived opaque token
 * that can be embedded in a console login URL.
 *
 * Reference: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_enable-console-custom-url.html
 */
async function getSigninToken(
  tmpCreds: AwsTemporaryCredentials,
  sessionDurationSeconds: number
): Promise<string> {
  // The session payload must NOT include any additional fields
  const sessionPayload = JSON.stringify({
    sessionId: tmpCreds.sessionId,
    sessionKey: tmpCreds.sessionKey,
    sessionToken: tmpCreds.sessionToken,
  });

  const params = new URLSearchParams({
    Action: "getSigninToken",
    SessionDuration: String(sessionDurationSeconds),
    Session: sessionPayload,
  });

  const url = `${AWS_FEDERATION_ENDPOINT}?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new AwsFederationError("Network error contacting AWS federation endpoint", err);
  }

  if (!res.ok) {
    throw new AwsFederationError(
      `AWS federation endpoint returned HTTP ${res.status}. ` +
      `Check that STS credentials are valid and not expired.`
    );
  }

  let body: { SigninToken?: string };
  try {
    body = await res.json();
  } catch {
    throw new AwsFederationError("AWS federation endpoint returned non-JSON response");
  }

  if (!body.SigninToken) {
    throw new AwsFederationError("AWS federation endpoint did not return a SigninToken");
  }

  return body.SigninToken;
}

// ─── Build final login URL ────────────────────────────────────────────────────

function buildLoginUrl(signinToken: string, config: AwsResourceConfig): string {
  const destination = config.destination || AWS_CONSOLE_BASE;
  validateDestination(destination); // re-validate here as an extra safety check

  const params = new URLSearchParams({
    Action: "login",
    Issuer: config.issuer || "internal-broker",
    Destination: destination,
    SigninToken: signinToken,
  });

  return `${AWS_FEDERATION_ENDPOINT}?${params.toString()}`;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateDestination(destination: string): void {
  if (!destination || typeof destination !== "string") {
    throw new AwsValidationError("destination is required and must be a string");
  }

  const isAllowed = ALLOWED_DESTINATION_PREFIXES.some((prefix) =>
    destination.startsWith(prefix)
  );

  if (!isAllowed) {
    // Do not echo the destination back to avoid leaking internal config
    throw new AwsValidationError(
      "destination URL is not in the allowlist. " +
      "Only AWS Console URLs are permitted."
    );
  }
}

function clampDuration(requestedSeconds: number): number {
  if (typeof requestedSeconds !== "number" || isNaN(requestedSeconds)) {
    return 3600; // safe default
  }
  return Math.min(STS_MAX_DURATION_SECONDS, Math.max(STS_MIN_DURATION_SECONDS, requestedSeconds));
}

/**
 * STS RoleSessionName must match [w+=,.@-]+ and be ≤ 64 chars.
 * We sanitize aggressively to avoid injection and truncate safely.
 */
function sanitizeSessionName(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9+=,.@_-]/g, "-")
    .slice(0, 64);
}

// ─── STS Client factory ───────────────────────────────────────────────────────

function buildStsClient(brokerCreds: AwsBrokerCredentials, region: string): STSClient {
  return new STSClient({
    region,
    credentials: {
      accessKeyId: brokerCreds.accessKeyId,
      secretAccessKey: brokerCreds.secretAccessKey,
      ...(brokerCreds.sessionToken ? { sessionToken: brokerCreds.sessionToken } : {}),
    },
  });
}

// ─── Domain-specific error classes ───────────────────────────────────────────

export class AwsStsError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AwsStsError";
    if (cause instanceof Error) {
      // Attach cause without leaking raw AWS API error messages to callers
      this.stack = `${this.stack}\nCaused by: ${cause.message}`;
    }
  }
}

export class AwsFederationError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AwsFederationError";
    if (cause instanceof Error) {
      this.stack = `${this.stack}\nCaused by: ${cause.message}`;
    }
  }
}

export class AwsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AwsValidationError";
  }
}

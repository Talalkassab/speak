# GitHub Actions Secrets Setup Guide

This document outlines the required secrets for the comprehensive testing suite GitHub Actions workflow.

## Required Secrets

### Testing Environment Secrets

Add the following secrets to your GitHub repository settings (Settings → Secrets and variables → Actions):

#### Database and Supabase
- `TEST_SUPABASE_URL` - Your test Supabase project URL
- `TEST_SUPABASE_ANON_KEY` - Your test Supabase anonymous key
- `TEST_SUPABASE_SERVICE_ROLE_KEY` - Your test Supabase service role key (for integration tests)

#### AI Services
- `TEST_OPENROUTER_API_KEY` - OpenRouter API key for AI testing (can be a limited test key)

#### Code Quality and Security
- `SONAR_TOKEN` - SonarCloud authentication token
- `CODECOV_TOKEN` - Codecov token for coverage reporting

#### Notifications
- `SLACK_WEBHOOK_URL` - Slack webhook URL for test failure notifications (optional)

## Setting Up Test Environment

### 1. Create Test Supabase Project

```bash
# Create a separate Supabase project for testing
supabase projects create hr-platform-test

# Get project details
supabase projects list
```

### 2. Configure Test Database

```bash
# Link to test project
supabase link --project-ref your-test-project-ref

# Run migrations
supabase db push

# Generate test data (optional)
npm run saudi-law:load
```

### 3. Set up SonarCloud

1. Go to [SonarCloud](https://sonarcloud.io)
2. Import your GitHub repository
3. Copy the project token
4. Add as `SONAR_TOKEN` secret

### 4. Configure Codecov

1. Go to [Codecov](https://codecov.io)
2. Add your repository
3. Copy the upload token
4. Add as `CODECOV_TOKEN` secret

## Environment Variables for Local Testing

Create `.env.test` file for local test runs:

```env
# Test Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/test_db
TEST_SUPABASE_URL=your-test-supabase-url
TEST_SUPABASE_ANON_KEY=your-test-anon-key
TEST_SUPABASE_SERVICE_ROLE_KEY=your-test-service-key

# AI Services (use test/limited keys)
TEST_OPENROUTER_API_KEY=your-test-openrouter-key

# Testing Configuration
NODE_ENV=test
CI=true
```

## Security Best Practices

### Separate Test Environment
- Use a completely separate Supabase project for testing
- Use limited API keys with restricted quotas
- Never use production secrets in testing

### Secret Rotation
- Rotate test secrets regularly
- Use separate GitHub environments for different branches
- Monitor secret usage in GitHub Actions logs

### Access Control
- Limit secret access to necessary workflows only
- Use environment-specific secrets when possible
- Regular audit of secret usage

## Workflow Triggers

The comprehensive testing workflow runs on:

- **Push to main/develop**: Full test suite
- **Pull requests**: Full test suite with PR comments
- **Scheduled daily**: Complete testing including performance and security scans
- **Manual trigger**: For debugging and maintenance

## Test Data Management

### Arabic Test Content
The workflow includes specific Arabic language test data:
- Sample HR documents in Arabic
- Voice recordings for speech testing
- RTL layout test cases
- Arabic legal terminology

### Performance Test Data
- Realistic user interaction patterns
- Arabic query datasets
- Document processing samples
- Load testing scenarios

## Troubleshooting

### Common Issues

1. **Test Database Connection Failures**
   - Verify DATABASE_URL format
   - Check PostgreSQL service status
   - Ensure test database exists

2. **Supabase Authentication Errors**
   - Verify project URL and keys
   - Check project permissions
   - Ensure test project is active

3. **Performance Test Failures**
   - Check application startup time
   - Verify test data availability
   - Monitor resource usage

4. **Arabic Language Test Issues**
   - Ensure Arabic fonts are installed
   - Check locale configuration
   - Verify UTF-8 encoding

### Getting Help

If you encounter issues with the testing setup:

1. Check GitHub Actions logs for detailed error messages
2. Verify all required secrets are properly set
3. Test individual components locally first
4. Review test data and mock configurations

## Monitoring and Maintenance

### Regular Tasks
- Monitor test execution times
- Update test data periodically  
- Review and update security scan configurations
- Maintain Arabic language test cases

### Performance Monitoring
- Track test suite execution time trends
- Monitor resource usage during tests
- Review performance test thresholds quarterly
- Update load testing scenarios based on usage patterns
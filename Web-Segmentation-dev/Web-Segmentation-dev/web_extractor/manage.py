"""
Objective        -   Entry point for Django administrative commands via CLI
    main()       -   Configure settings module and invoke Django's management utility
"""
#!/usr/bin/env python
import os
import sys


def main():
    """Run administrative tasks."""
    # Ensure the DJANGO_SETTINGS_MODULE environment variable is set
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'web_extractor.settings')
    try:
        # Import Django's command-line execution function
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    # Execute the command-line arguments
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()

from setuptools import setup

setup(
    name='bot',
    packages=['bot', 'bot.data'],
    include_package_data=True,
    install_requires=['braceexpand']
)

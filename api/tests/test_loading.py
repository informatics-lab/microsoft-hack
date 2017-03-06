import iris

from bot.data import Parameter

import unittest


class TestLoading(unittest.TestCase):
    def setUp(self):
        self.parameter = Parameter('temperature', './sample_data/maximum-temperature')

    def test_load(self):
        cube = self.parameter.load()
        self.assertIsInstance(cube, iris.cube.Cube)

    def test_load_with_filter(self):
        cube = self.parameter.load('1960')
        self.assertIsInstance(cube, iris.cube.Cube)

    def test_load_with_failing_fiter(self):
        with self.assertRaises(ValueError):
            self.parameter.load('fake_filter')

if __name__ == '__main__':
    unittest.main()

import iris

from bot.data import Parameter, Parameters

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


class TestParameters(unittest.TestCase):
    def setUp(self):
        self.path = './sample_data'
        self.parameters = Parameters(self.path)

    def test_paths(self):
        expected = ['{}/maximum-temperature'.format(self.path)]
        self.assertEqual(expected, self.parameters.paths)

    def test_names(self):
        expected = ['maximum-temperature']
        self.assertEqual(expected, self.parameters.names)

    def test_get_parameter(self):
        param = self.parameters.get('maximum-temperature')
        self.assertEqual(param.name, 'maximum-temperature')
        self.assertEqual(param.data_path, '{}/maximum-temperature'.format(self.path))


if __name__ == '__main__':
    unittest.main()

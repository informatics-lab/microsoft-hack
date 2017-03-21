from bot.data import expand_range, expand_years, date_inputs

import unittest
import datetime


class TestExpandYears(unittest.TestCase):
    def test_with_date(self):
        start_date = datetime.date(2017, 1, 1)
        expected_dates = [datetime.date(2015, 1, 1),
                          datetime.date(2016, 1, 1),
                          datetime.date(2017, 1, 1)]
        self.assertEqual(expand_years(start_date, 2), expected_dates)

    def test_with_datetime(self):
        start_date = datetime.datetime(2017, 1, 1, 12, 0, 0)
        expected_dates = [datetime.datetime(2015, 1, 1, 12, 0, 0),
                          datetime.datetime(2016, 1, 1, 12, 0, 0),
                          datetime.datetime(2017, 1, 1, 12, 0, 0)]

        self.assertEqual(expand_years(start_date, 2), expected_dates)

    def test_for_zero_years(self):
        start_date = datetime.date(2017, 1, 1)
        expected_dates = [start_date]
        self.assertEqual(expand_years(start_date, 0), expected_dates)

    def test_with_multiple_dates(self):
        start_dates = [datetime.date(2017, 1, 1), datetime.date(2017, 1, 2)]
        expected_dates = [datetime.date(2015, 1, 1), datetime.date(2015, 1, 2),
                          datetime.date(2016, 1, 1), datetime.date(2016, 1, 2),
                          datetime.date(2017, 1, 1), datetime.date(2017, 1, 2)]

        self.assertEqual(expand_years(start_dates, 2), expected_dates)

    def test_leap_year(self):
        start_date = datetime.date(2016, 2, 29)
        expected_dates = [datetime.date(2012, 2, 29), datetime.date(2013, 2, 28),
                          datetime.date(2014, 2, 28), datetime.date(2015, 2, 28),
                          datetime.date(2016, 2, 29)]
        self.assertEqual(expand_years(start_date, 4), expected_dates)


class TestExpandRange(unittest.TestCase):
    def test_with_dates(self):
        start_date = datetime.date(2017, 1, 30)
        end_date = datetime.date(2017, 2, 2)
        expected = [datetime.date(2017, 1, 30), datetime.date(2017, 1, 31),
                    datetime.date(2017, 2, 1), datetime.date(2017, 2, 2)]
        self.assertEqual(expand_range(start_date, end_date), expected)

    def test_with_datetimes(self):
        start_date = datetime.datetime(2017, 1, 30, 12, 0, 0)
        end_date = datetime.datetime(2017, 2, 2, 12, 0, 0)
        expected = [datetime.datetime(2017, 1, 30, 12, 0, 0), datetime.datetime(2017, 1, 31, 12, 0, 0),
                    datetime.datetime(2017, 2, 1, 12, 0, 0), datetime.datetime(2017, 2, 2, 12, 0, 0)]
        self.assertEqual(expand_range(start_date, end_date), expected)

    def test_with_zero_range(self):
        start_date = datetime.datetime(2017, 1, 30, 12, 0, 0)
        end_date = start_date
        expected = [start_date]
        self.assertEqual(expand_range(start_date, end_date), expected)

    def test_leap_year(self):
        start_date = datetime.date(2016, 2, 28)
        end_date = datetime.date(2016, 3, 1)
        expected = [datetime.date(2016, 2, 28), datetime.date(2016, 2, 29),
                    datetime.date(2016, 3, 1)]
        self.assertEqual(expand_range(start_date, end_date), expected)

    def test_not_leap_year(self):
        start_date = datetime.date(2017, 2, 28)
        end_date = datetime.date(2017, 3, 1)
        expected = [datetime.date(2017, 2, 28), datetime.date(2017, 3, 1)]
        self.assertEqual(expand_range(start_date, end_date), expected)


class TestHandleInputs(unittest.TestCase):
    def test_with_no_date(self):
        expected = (datetime.datetime(1960, 1, 1, 12), datetime.datetime(2015, 12, 31, 12))
        actual = date_inputs()
        self.assertEqual(actual, expected)

    def test_with_one_date(self):
        date = '2010-01-01'
        expected = (datetime.datetime(2010, 1, 1, 12), datetime.datetime(2010, 1, 1, 12))
        self.assertEqual(date_inputs(date=date), expected)

    def test_with_start_date(self):
        start_date = '1992-03-10'
        expected = (datetime.datetime(1992, 3, 10, 12), datetime.datetime(2015, 12, 31, 12))
        self.assertEqual(date_inputs(start_date=start_date), expected)

    def test_with_end_date(self):
        end_date = '1984-02-29'
        expected = (datetime.datetime(1960, 1, 1, 12), datetime.datetime(1984, 2, 29, 12))
        self.assertEqual(date_inputs(end_date=end_date), expected)

    def test_with_start_and_end(self):
        start_date = '2000-01-01'
        end_date = '2001-01-01'
        expected = (datetime.datetime(2000, 1, 1, 12), datetime.datetime(2001, 1, 1, 12))
        self.assertEqual(date_inputs(start_date=start_date, end_date=end_date), expected)


if __name__ == '__main__':
    unittest.main()
